// Classic Traveller Speculative Cargo — Business Logic
//
// Pure functions; no React dependencies.  Each function is independently
// testable with deterministic inputs.

import { TradeTags } from "./tradeTags";
import { TradeGood, TagDMRule } from "../data/tradeGoods";
import { lookupActualValue } from "../data/actualValueTable";
import { TRADE_GOODS } from "../data/tradeGoods";
import { Rng, d6, rollDice, sumDice, createSeededRng, hashSeed } from "./dice";

// ─── Quantity formula parsing ─────────────────────────────────────────────────

export interface ParsedFormula {
  count: number;      // number of d6 to roll
  multiplier: number; // multiply the sum by this
  constant: number;   // add this after multiplying
}

/**
 * Parse a quantity formula string.
 * Supports: "1D6", "2D6", "1D6x10", "2D6x5", "1D6+5", "2D6x10+5"
 * Returns { count:1, multiplier:1, constant:0 } on parse failure.
 */
export function parseQuantityFormula(formula: string): ParsedFormula {
  const m = formula
    .toUpperCase()
    .match(/^(\d+)D6(?:X(\d+))?([+-]\d+)?$/);
  if (!m) return { count: 1, multiplier: 1, constant: 0 };
  return {
    count:      parseInt(m[1], 10),
    multiplier: m[2] ? parseInt(m[2], 10) : 1,
    constant:   m[3] ? parseInt(m[3], 10) : 0,
  };
}

// ─── Rolling helpers ──────────────────────────────────────────────────────────

/** Roll a quantity from a formula. Returns dice results and computed total (min 1). */
export function rollQuantity(
  formula: string,
  rng?: Rng,
): { dice: number[]; total: number } {
  const { count, multiplier, constant } = parseQuantityFormula(formula);
  const dice = rollDice(count, rng);
  const total = Math.max(1, sumDice(dice) * multiplier + constant);
  return { dice, total };
}

/** Roll which trade good appears in a lot (1d6 → index into TRADE_GOODS). */
export function rollTradeGood(rng?: Rng): { die: number; good: TradeGood } {
  const die = d6(rng);
  // Map die 1–6 onto goods list (wraps if list < 6)
  const good = TRADE_GOODS[(die - 1) % TRADE_GOODS.length];
  return { die, good };
}

// ─── DM calculation ───────────────────────────────────────────────────────────

export interface DMBreakdownItem {
  source: string;
  dm: number;
}

/**
 * Calculate total DM from trade tag rules for the given world tags.
 * Also accepts optional brokerDM and skillDM (numeric adjustments).
 * Returns total DM and a per-source breakdown for the audit log.
 */
export function calculateDM(
  rules: TagDMRule[],
  tags: TradeTags,
  brokerDM = 0,
  skillDM = 0,
): { total: number; breakdown: DMBreakdownItem[] } {
  const tagItems: DMBreakdownItem[] = rules
    .filter((r) => tags[r.tag])
    .map((r) => ({ source: r.tag, dm: r.dm }));

  const extras: DMBreakdownItem[] = [];
  if (brokerDM !== 0) extras.push({ source: "Broker", dm: brokerDM });
  if (skillDM  !== 0) extras.push({ source: "Skill",  dm: skillDM  });

  const breakdown = [...tagItems, ...extras];
  const total = breakdown.reduce((s, b) => s + b.dm, 0);
  return { total, breakdown };
}

// ─── Actual value roll ────────────────────────────────────────────────────────

export interface ActualValueRoll {
  dice: number[];
  rawRoll: number;    // sum of dice + dm (before clamping)
  clampedRoll: number; // clamped to 2–12 for table lookup
  pct: number;        // resulting percentage
}

/**
 * Roll 2d6 + dm, clamp to table bounds (2–12), and look up the percentage.
 */
export function rollActualValue(
  dm: number,
  stage: "purchase" | "resale",
  rng?: Rng,
): ActualValueRoll {
  const dice = rollDice(2, rng);
  const rawRoll = sumDice(dice) + dm;
  const clampedRoll = Math.max(2, Math.min(12, rawRoll));
  const pct = lookupActualValue(clampedRoll, stage);
  return { dice, rawRoll, clampedRoll, pct };
}

// ─── Cost / cargo / revenue calculations ─────────────────────────────────────

/** Purchase cost: basePrice × qty × (pct / 100), rounded to nearest credit. */
export function computePurchaseCost(
  basePrice: number,
  qty: number,
  pct: number,
): number {
  return Math.round(basePrice * qty * pct / 100);
}

/**
 * Cargo space consumed by a purchased lot.
 * Ton-goods: qty tons exactly.
 * Item-goods: qty × cargoPerItemTons (override takes priority over default).
 */
export function computeCargoUse(
  good: TradeGood,
  qty: number,
  cargoPerItemOverride?: number,
): number {
  if (good.unitType === "ton") return qty;
  const perItem =
    cargoPerItemOverride !== undefined
      ? cargoPerItemOverride
      : (good.defaultCargoPerItemTons ?? 0.01);
  return qty * perItem;
}

/** Resale revenue: basePrice × qty × (pct / 100), rounded to nearest credit. */
export function computeResaleRevenue(
  basePrice: number,
  qty: number,
  pct: number,
): number {
  return Math.round(basePrice * qty * pct / 100);
}

/** Profit / loss = revenue − cost. */
export function computeProfitLoss(revenue: number, cost: number): number {
  return revenue - cost;
}

// ─── Lot rolling ─────────────────────────────────────────────────────────────

export interface RolledLot {
  id: string;
  goodsRollDie: number;  // 1d6 used to pick the good
  good: TradeGood;
  // Quantity
  qtyDice: number[];
  qty: number;
  // Purchase price roll
  purchaseDMBreakdown: DMBreakdownItem[];
  purchaseDMTotal: number;
  purchaseValueDice: number[];
  purchaseRawRoll: number;
  purchaseClampedRoll: number;
  purchasePct: number;
  // Derived cost & cargo for the full rolled qty
  purchaseTotalCost: number;
  cargoTons: number;
}

/**
 * Roll a set of speculative cargo lots at the origin world.
 *
 * @param originTags   Trade tags of the origin world.
 * @param lotCount     How many lots to roll (usually 1–6).
 * @param brokerDM     Optional broker skill DM.
 * @param skillDM      Optional other skill DM (e.g. Streetwise).
 * @param seedStr      Optional string seed for reproducible rolls.
 */
export function rollTradeLots(
  originTags: TradeTags,
  lotCount: number,
  brokerDM = 0,
  skillDM = 0,
  seedStr?: string,
): RolledLot[] {
  const rng: Rng | undefined =
    seedStr ? createSeededRng(hashSeed(seedStr)) : undefined;

  return Array.from({ length: Math.max(1, lotCount) }, (_, i) => {
    const { die: goodsRollDie, good } = rollTradeGood(rng);
    const { dice: qtyDice, total: qty }  = rollQuantity(good.quantityFormula, rng);
    const purchaseDM = calculateDM(good.purchaseDMRules, originTags, brokerDM, skillDM);
    const avRoll = rollActualValue(purchaseDM.total, "purchase", rng);

    const purchaseTotalCost = computePurchaseCost(good.basePrice, qty, avRoll.pct);
    const cargoTons = computeCargoUse(good, qty);

    return {
      id: `lot-${i}`,
      goodsRollDie,
      good,
      qtyDice,
      qty,
      purchaseDMBreakdown: purchaseDM.breakdown,
      purchaseDMTotal: purchaseDM.total,
      purchaseValueDice: avRoll.dice,
      purchaseRawRoll: avRoll.rawRoll,
      purchaseClampedRoll: avRoll.clampedRoll,
      purchasePct: avRoll.pct,
      purchaseTotalCost,
      cargoTons,
    };
  });
}

// ─── Resale ───────────────────────────────────────────────────────────────────

export interface ResaleLotResult {
  lotId: string;
  good: TradeGood;
  purchasedQty: number;
  purchaseCost: number;
  cargoTons: number;
  // Resale roll
  resaleDMBreakdown: DMBreakdownItem[];
  resaleDMTotal: number;
  resaleValueDice: number[];
  resaleRawRoll: number;
  resaleClampedRoll: number;
  resalePct: number;
  resaleRevenue: number;
  profit: number;
}

export interface PurchasedLotInput {
  lotId: string;
  good: TradeGood;
  purchasePct: number;
  selectedQty: number;
  cargoPerItemOverride?: number;
}

/**
 * Roll resale prices and compute profit/loss for a set of purchased lots.
 *
 * @param purchased    Lots the player has chosen to buy (with quantities).
 * @param destTags     Trade tags of the destination world.
 * @param brokerDM     Optional broker skill DM.
 * @param skillDM      Optional other skill DM.
 * @param seedStr      Optional string seed (will be offset so resale differs from purchase).
 */
export function computeResale(
  purchased: PurchasedLotInput[],
  destTags: TradeTags,
  brokerDM = 0,
  skillDM = 0,
  seedStr?: string,
): ResaleLotResult[] {
  // Offset the seed so resale rolls differ from purchase rolls
  const rng: Rng | undefined =
    seedStr ? createSeededRng(hashSeed(seedStr + "-resale")) : undefined;

  return purchased.map((p) => {
    const resaleDM = calculateDM(p.good.resaleDMRules, destTags, brokerDM, skillDM);
    const avRoll = rollActualValue(resaleDM.total, "resale", rng);
    const purchaseCost = computePurchaseCost(p.good.basePrice, p.selectedQty, p.purchasePct);
    const cargoTons = computeCargoUse(p.good, p.selectedQty, p.cargoPerItemOverride);
    const resaleRevenue = computeResaleRevenue(p.good.basePrice, p.selectedQty, avRoll.pct);
    const profit = computeProfitLoss(resaleRevenue, purchaseCost);

    return {
      lotId: p.lotId,
      good: p.good,
      purchasedQty: p.selectedQty,
      purchaseCost,
      cargoTons,
      resaleDMBreakdown: resaleDM.breakdown,
      resaleDMTotal: resaleDM.total,
      resaleValueDice: avRoll.dice,
      resaleRawRoll: avRoll.rawRoll,
      resaleClampedRoll: avRoll.clampedRoll,
      resalePct: avRoll.pct,
      resaleRevenue,
      profit,
    };
  });
}
