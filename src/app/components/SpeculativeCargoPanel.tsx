"use client";

import { useState } from "react";
import { ShipSpecs } from "../types";
import { parseUWP } from "../utils/uwp";
import { deriveTradeTagsFromUWP, tradeTagList, TradeTags } from "../utils/tradeTags";
import {
  rollTradeLots,
  computeResale,
  computeCargoUse,
  computePurchaseCost,
  parseQuantityFormula,
  RolledLot,
  ResaleLotResult,
  PurchasedLotInput,
} from "../utils/speculativeCargo";
import { sumDice } from "../utils/dice";
import { TradeGood } from "../data/tradeGoods";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCredits(amount: number): string {
  return `Cr${amount.toLocaleString()}`;
}

function formatTons(t: number): string {
  if (Number.isInteger(t)) return `${t} t`;
  return `${t.toFixed(3).replace(/\.?0+$/, "")} t`;
}

function signedDM(dm: number): string {
  return dm >= 0 ? `+${dm}` : `${dm}`;
}

// ─── TagPill ─────────────────────────────────────────────────────────────────

const TAG_COLORS: Record<string, string> = {
  Ag: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  Na: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  In: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  Ni: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  Ri: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  Po: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

function TagPill({ tag }: { tag: string }) {
  return (
    <span
      className={`inline-block px-1.5 py-0.5 rounded text-xs font-semibold ${TAG_COLORS[tag] ?? "bg-gray-100 text-gray-600"}`}
    >
      {tag}
    </span>
  );
}

function TradeTagRow({
  label,
  uwp,
  tags,
}: {
  label: string;
  uwp: string;
  tags: TradeTags | null;
}) {
  const tagNames = tags ? tradeTagList(tags) : [];
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="text-gray-500 dark:text-gray-400 w-20 flex-shrink-0">
        {label}
      </span>
      <span className="font-mono text-amber-700 dark:text-amber-400">{uwp}</span>
      {tags === null ? (
        <span className="text-gray-400 italic">invalid UWP — tags unknown</span>
      ) : tagNames.length === 0 ? (
        <span className="text-gray-400 italic">no trade tags</span>
      ) : (
        tagNames.map((t) => <TagPill key={t} tag={t} />)
      )}
    </div>
  );
}

// ─── InfoTip ─────────────────────────────────────────────────────────────────

function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block align-middle">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-emerald-100 hover:text-emerald-600 dark:hover:bg-emerald-900 dark:hover:text-emerald-300 text-xs font-bold focus:outline-none transition-colors"
        aria-label="More information"
      >
        ?
      </button>
      {open && (
        <div
          className="absolute z-20 left-6 top-0 w-64 rounded-lg bg-gray-900 text-white text-xs p-3 shadow-xl"
          role="tooltip"
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute top-1.5 right-1.5 text-gray-400 hover:text-white leading-none"
            aria-label="Close"
          >
            ✕
          </button>
          <p className="pr-4">{text}</p>
        </div>
      )}
    </span>
  );
}

// ─── DM Breakdown ─────────────────────────────────────────────────────────────

function DMList({ items }: { items: { source: string; dm: number }[] }) {
  if (items.length === 0)
    return <span className="text-gray-400 dark:text-gray-500">none</span>;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {items.map((b) => (
        <span
          key={b.source}
          className={`inline-block px-1 py-0.5 rounded text-xs font-mono ${
            b.dm >= 0
              ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
              : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
          }`}
        >
          {b.source} {signedDM(b.dm)}
        </span>
      ))}
    </span>
  );
}

// ─── DiceDisplay ──────────────────────────────────────────────────────────────

function DiceDisplay({ dice }: { dice: number[] }) {
  return (
    <span className="inline-flex gap-1">
      {dice.map((d, i) => (
        <span
          key={i}
          className="inline-flex items-center justify-center w-6 h-6 rounded bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 text-xs font-bold"
        >
          {d}
        </span>
      ))}
    </span>
  );
}

// ─── Number Input ─────────────────────────────────────────────────────────────

function NumInput({
  label,
  value,
  onChange,
  hint,
  min,
  max,
  step,
  infoText,
  className,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
  min?: number;
  max?: number;
  step?: number;
  infoText?: string;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1 ${className ?? ""}`}>
      <label className="text-xs font-medium text-gray-600 dark:text-gray-400 flex items-center">
        {label}
        {infoText && <InfoTip text={infoText} />}
        {hint && (
          <span className="ml-2 text-gray-400 dark:text-gray-500 font-normal">
            ({hint})
          </span>
        )}
      </label>
      <input
        type="number"
        min={min ?? 0}
        max={max}
        step={step ?? 1}
        value={value === 0 ? "" : value}
        placeholder="0"
        onChange={(e) =>
          onChange(
            Math.max(
              min ?? 0,
              Math.min(max ?? Infinity, parseInt(e.target.value, 10) || 0),
            ),
          )
        }
        className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
      />
    </div>
  );
}

// ─── Purchase selection state ─────────────────────────────────────────────────

interface PurchaseState {
  isSelected: boolean;
  selectedQty: number;
  cargoPerItemOverride: number | undefined;
}

// ─── SpeculativeCargoPanel ────────────────────────────────────────────────────

export default function SpeculativeCargoPanel({
  shipSpecs,
  originUWP,
  destUWP,
}: {
  shipSpecs: ShipSpecs;
  originUWP: string;
  destUWP: string;
}) {
  // ── Derived trade tags ─────────────────────────────────────────────────────
  const originParsed = parseUWP(originUWP);
  const destParsed   = parseUWP(destUWP);
  const originTags   = originParsed ? deriveTradeTagsFromUWP(originParsed) : null;
  const destTags     = destParsed   ? deriveTradeTagsFromUWP(destParsed)   : null;

  // ── Inputs ─────────────────────────────────────────────────────────────────
  const [capital, setCapital]     = useState(0);
  const [freeCargo, setFreeCargo] = useState(shipSpecs.cargoSpace);
  const [brokerDM, setBrokerDM]   = useState(0);
  const [skillDM, setSkillDM]     = useState(0);
  const [numLots, setNumLots]     = useState(1);
  const [seed, setSeed]           = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // ── Rolling state ──────────────────────────────────────────────────────────
  const [rolledLots, setRolledLots] = useState<RolledLot[]>([]);
  const [purchases, setPurchases]   = useState<Record<string, PurchaseState>>({});
  const [resaleResults, setResaleResults] = useState<ResaleLotResult[]>([]);
  const [phase, setPhase] = useState<"idle" | "rolled" | "resale">("idle");

  // ── Cargo / capital tracking ───────────────────────────────────────────────
  const selectedLots = rolledLots.filter((l) => purchases[l.id]?.isSelected);

  const totalCargoUsed = selectedLots.reduce((sum, l) => {
    const p = purchases[l.id];
    const qty = p?.selectedQty ?? l.qty;
    const override = p?.cargoPerItemOverride;
    return sum + computeCargoUse(l.good, qty, override);
  }, 0);

  const totalCost = selectedLots.reduce((sum, l) => {
    const p = purchases[l.id];
    const qty = p?.selectedQty ?? l.qty;
    return sum + computePurchaseCost(l.good.basePrice, qty, l.purchasePct);
  }, 0);

  const remainingCapital = capital > 0 ? capital - totalCost : undefined;
  const remainingCargo   = freeCargo > 0 ? freeCargo - totalCargoUsed : undefined;

  // ── Actions ────────────────────────────────────────────────────────────────

  function handleRollLots() {
    if (!originTags) return;
    const lots = rollTradeLots(
      originTags,
      numLots,
      brokerDM,
      skillDM,
      seed || undefined,
    );

    // Auto-clamp qty by capital and cargo space (best-effort)
    const initPurchases: Record<string, PurchaseState> = {};
    let remCap  = capital > 0 ? capital : Infinity;
    let remCargo = freeCargo > 0 ? freeCargo : Infinity;

    for (const lot of lots) {
      const cargoForFull = computeCargoUse(lot.good, lot.qty);
      const costForFull  = lot.purchaseTotalCost;
      const fitsAll = cargoForFull <= remCargo && costForFull <= remCap;

      // Compute max affordable / fittable quantity
      let maxQty = lot.qty;
      if (capital > 0) {
        const maxByFunds = Math.floor((remCap / lot.good.basePrice) * (100 / lot.purchasePct));
        maxQty = Math.min(maxQty, Math.max(0, maxByFunds));
      }
      if (freeCargo > 0 && lot.good.unitType === "ton") {
        maxQty = Math.min(maxQty, Math.floor(remCargo));
      }

      const selectedQty = fitsAll ? lot.qty : maxQty;
      const isSelected  = selectedQty > 0;

      initPurchases[lot.id] = {
        isSelected,
        selectedQty,
        cargoPerItemOverride: undefined,
      };

      if (isSelected) {
        remCap  -= computePurchaseCost(lot.good.basePrice, selectedQty, lot.purchasePct);
        remCargo -= computeCargoUse(lot.good, selectedQty);
      }
    }

    setRolledLots(lots);
    setPurchases(initPurchases);
    setResaleResults([]);
    setPhase("rolled");
  }

  function updatePurchase(
    id: string,
    patch: Partial<PurchaseState>,
  ) {
    setPurchases((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
    setResaleResults([]);
    if (phase === "resale") setPhase("rolled");
  }

  function handleComputeResale() {
    if (!destTags) return;
    const inputs: PurchasedLotInput[] = selectedLots
      .map((l) => {
        const p = purchases[l.id];
        return {
          lotId: l.id,
          good:  l.good,
          purchasePct: l.purchasePct,
          selectedQty: p.selectedQty,
          cargoPerItemOverride: p.cargoPerItemOverride,
        };
      });

    const results = computeResale(
      inputs,
      destTags,
      brokerDM,
      skillDM,
      seed || undefined,
    );
    setResaleResults(results);
    setPhase("resale");
  }

  // ── Resale totals ──────────────────────────────────────────────────────────
  const totalRevenue = resaleResults.reduce((s, r) => s + r.resaleRevenue, 0);
  const totalProfit  = resaleResults.reduce((s, r) => s + r.profit, 0);

  const canRoll       = originTags !== null;
  const canResale     = phase === "rolled" && destTags !== null && selectedLots.length > 0;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-emerald-700 px-6 py-3 flex items-center gap-2">
        <h2 className="text-lg font-semibold text-white">
          💰 Speculative Cargo (Classic)
        </h2>
        <InfoTip text="Roll for speculative trade lots at the origin world. Select which lots to purchase, then compute resale profit at the destination. Rules are data-driven — edit src/app/data/tradeGoods.ts and src/app/data/actualValueTable.ts to customise." />
      </div>

      <div className="p-6 space-y-6">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Speculative cargo from Classic Traveller Book 2. Lots are rolled at
          the origin world; trade tags and DMs are derived automatically from
          the UWPs set in the Roll section above. Edit the goods and value
          tables in{" "}
          <code className="font-mono text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">
            src/app/data/
          </code>{" "}
          to populate them with your rulebook&apos;s data.
        </p>

        {/* Trade tags display */}
        <div className="rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Derived Trade Tags
            <InfoTip text="Trade tags are derived from UWP digits following Classic Traveller rules. Ag=Agricultural, Na=Non-Ag, In=Industrial, Ni=Non-Industrial, Ri=Rich, Po=Poor. They determine purchase/resale DMs." />
          </h3>
          <TradeTagRow label="Origin" uwp={originUWP || "—"} tags={originTags} />
          <TradeTagRow label="Destination" uwp={destUWP || "—"} tags={destTags} />
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <NumInput
            label="Capital"
            value={capital}
            onChange={setCapital}
            hint="credits"
            infoText="Available credits for purchases. Enter 0 to skip the capital constraint."
          />
          <NumInput
            label="Free Cargo"
            value={freeCargo}
            onChange={setFreeCargo}
            hint="tons"
            infoText="Available cargo space for speculative goods. Defaults to ship cargo space; reduce if other cargo is already allocated."
          />
          <NumInput
            label="Broker DM"
            value={brokerDM}
            onChange={setBrokerDM}
            hint="integer"
            min={-6}
            max={6}
            infoText="DM from broker skill (positive = better prices). Applied to both purchase and resale rolls."
          />
          <NumInput
            label="Skill DM"
            value={skillDM}
            onChange={setSkillDM}
            hint="integer"
            min={-6}
            max={6}
            infoText="Other skill DM (e.g. Streetwise). Applied to both purchase and resale rolls."
          />
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <NumInput
            label="Lots to roll"
            value={numLots}
            onChange={setNumLots}
            min={1}
            max={6}
            className="w-28"
            infoText="How many trade goods lots to roll. Typically 1; some campaigns allow more."
          />

          {/* Advanced / seed */}
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline focus:outline-none self-start"
            >
              {showAdvanced ? "▲ Hide" : "▼ Show"} advanced
            </button>
            {showAdvanced && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  Seed
                  <InfoTip text="Optional string seed for reproducible dice rolls. Leave blank for random rolls each time." />
                </label>
                <input
                  type="text"
                  value={seed}
                  onChange={(e) => setSeed(e.target.value)}
                  placeholder="e.g. session-42"
                  className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 w-36"
                />
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleRollLots}
            disabled={!canRoll}
            className="px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
          >
            🎲 Roll Lots
          </button>
        </div>

        {/* ── Rolled lots ─────────────────────────────────────────────────── */}
        {phase !== "idle" && rolledLots.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Available Speculative Lots
            </h3>

            <div className="space-y-3">
              {rolledLots.map((lot, i) => {
                const p = purchases[lot.id] ?? { isSelected: false, selectedQty: lot.qty };
                const cargoForSel = computeCargoUse(
                  lot.good,
                  p.selectedQty,
                  p.cargoPerItemOverride,
                );
                const costForSel = computePurchaseCost(
                  lot.good.basePrice,
                  p.selectedQty,
                  lot.purchasePct,
                );
                const wouldExceedCargo =
                  freeCargo > 0 &&
                  !p.isSelected &&
                  totalCargoUsed + cargoForSel > freeCargo;
                const wouldExceedCapital =
                  capital > 0 &&
                  !p.isSelected &&
                  totalCost + costForSel > capital;

                return (
                  <LotCard
                    key={lot.id}
                    index={i + 1}
                    lot={lot}
                    purchaseState={p}
                    onToggle={() =>
                      updatePurchase(lot.id, { isSelected: !p.isSelected })
                    }
                    onQtyChange={(qty) =>
                      updatePurchase(lot.id, { selectedQty: qty })
                    }
                    onCargoPerItemChange={(v) =>
                      updatePurchase(lot.id, { cargoPerItemOverride: v })
                    }
                    wouldExceedCargo={wouldExceedCargo}
                    wouldExceedCapital={wouldExceedCapital}
                    resaleResult={
                      phase === "resale"
                        ? resaleResults.find((r) => r.lotId === lot.id)
                        : undefined
                    }
                  />
                );
              })}
            </div>

            {/* Totals bar */}
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <TotalCell
                label="Cargo used"
                value={formatTons(totalCargoUsed)}
                sub={
                  freeCargo > 0
                    ? `${remainingCargo! < 0 ? "-" : ""}${formatTons(Math.abs(remainingCargo!))} remaining`
                    : "no limit"
                }
                warn={freeCargo > 0 && totalCargoUsed > freeCargo}
              />
              <TotalCell
                label="Cash spent"
                value={formatCredits(totalCost)}
                sub={
                  capital > 0
                    ? `${remainingCapital! < 0 ? "-" : ""}Cr${Math.abs(remainingCapital!).toLocaleString()} left`
                    : "no limit"
                }
                warn={capital > 0 && totalCost > capital}
              />
              {phase === "resale" && (
                <>
                  <TotalCell
                    label="Resale revenue"
                    value={formatCredits(totalRevenue)}
                  />
                  <TotalCell
                    label="Total profit/loss"
                    value={formatCredits(totalProfit)}
                    warn={totalProfit < 0}
                    positive={totalProfit >= 0}
                  />
                </>
              )}
            </div>

            {/* Compute resale button */}
            {phase !== "resale" && (
              <div className="flex gap-3 items-center flex-wrap">
                <button
                  type="button"
                  onClick={handleComputeResale}
                  disabled={!canResale}
                  className="px-6 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 active:bg-amber-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
                >
                  📊 Compute Resale
                </button>
                {!canResale && destTags === null && (
                  <span className="text-xs text-red-500 dark:text-red-400">
                    Enter a valid destination UWP first.
                  </span>
                )}
                {!canResale && destTags !== null && selectedLots.length === 0 && (
                  <span className="text-xs text-gray-400">
                    Select at least one lot to compute resale.
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

// ─── TotalCell ────────────────────────────────────────────────────────────────

function TotalCell({
  label,
  value,
  sub,
  warn,
  positive,
}: {
  label: string;
  value: string;
  sub?: string;
  warn?: boolean;
  positive?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      <span
        className={`font-semibold ${
          warn
            ? "text-red-600 dark:text-red-400"
            : positive
              ? "text-green-600 dark:text-green-400"
              : "text-gray-900 dark:text-gray-100"
        }`}
      >
        {value}
      </span>
      {sub && (
        <span className="text-xs text-gray-400 dark:text-gray-500">{sub}</span>
      )}
    </div>
  );
}

// ─── LotCard ─────────────────────────────────────────────────────────────────

function LotCard({
  index,
  lot,
  purchaseState,
  onToggle,
  onQtyChange,
  onCargoPerItemChange,
  wouldExceedCargo,
  wouldExceedCapital,
  resaleResult,
}: {
  index: number;
  lot: RolledLot;
  purchaseState: PurchaseState;
  onToggle: () => void;
  onQtyChange: (v: number) => void;
  onCargoPerItemChange: (v: number | undefined) => void;
  wouldExceedCargo: boolean;
  wouldExceedCapital: boolean;
  resaleResult?: ResaleLotResult;
}) {
  const [showDetail, setShowDetail] = useState(false);
  const { isSelected, selectedQty, cargoPerItemOverride } = purchaseState;
  const good: TradeGood = lot.good;
  const isItem = good.unitType === "item";
  const cargoPerItem =
    cargoPerItemOverride !== undefined
      ? cargoPerItemOverride
      : (good.defaultCargoPerItemTons ?? 0.01);

  const cargoForSel = computeCargoUse(good, selectedQty, cargoPerItemOverride);
  const costForSel  = computePurchaseCost(good.basePrice, selectedQty, lot.purchasePct);

  const disabled = !isSelected && (wouldExceedCargo || wouldExceedCapital);
  const warningText = wouldExceedCargo
    ? "Adding this lot would exceed available cargo space."
    : wouldExceedCapital
      ? "Adding this lot would exceed available capital."
      : undefined;

  return (
    <div
      className={`rounded-lg border overflow-hidden transition-colors ${
        isSelected
          ? "border-emerald-400 dark:border-emerald-600 bg-white dark:bg-gray-900"
          : disabled
            ? "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 opacity-50"
            : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
      }`}
    >
      {/* Lot header */}
      <div className="px-4 py-3 flex flex-wrap items-start gap-3">
        <label className="flex items-start gap-3 flex-1 cursor-pointer" title={warningText}>
          <input
            type="checkbox"
            checked={isSelected}
            disabled={disabled}
            onChange={onToggle}
            className="mt-0.5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 disabled:cursor-not-allowed"
          />
          <div className="flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">
                #{index}
              </span>
              <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                {good.name}
              </span>
              <span className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 px-1.5 py-0.5 rounded font-medium">
                {isItem ? "per item" : "tons"}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
              <span>
                Base: {formatCredits(good.basePrice)}/{isItem ? "item" : "t"}
              </span>
              <span>
                Qty: {lot.qty} {isItem ? "items" : "t"}
                <span className="ml-1 text-gray-400">
                ({lot.qtyDice.join("+")} = {sumDice(lot.qtyDice)})
                </span>
              </span>
              <span>
                Buy %:{" "}
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                  {lot.purchasePct}%
                </span>
                <span className="ml-1 text-gray-400">
                  (roll {lot.purchaseClampedRoll}, DM {signedDM(lot.purchaseDMTotal)})
                </span>
              </span>
            </div>
          </div>
        </label>

        {/* Cost / cargo summary */}
        <div className="text-right space-y-0.5 text-xs flex-shrink-0">
          <div className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
            {formatCredits(costForSel)}
          </div>
          <div className="text-gray-400 dark:text-gray-500">
            {formatTons(cargoForSel)}
          </div>
        </div>
      </div>

      {/* Quantity & cargo-per-item controls (when selected) */}
      {isSelected && (
        <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-3 flex flex-wrap gap-4 items-end bg-emerald-50 dark:bg-emerald-950/30">
          {/* Qty input */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
              {isItem ? "Items to buy" : "Tons to buy"}
            </label>
            <input
              type="number"
              min={1}
              max={lot.qty}
              value={selectedQty}
              onChange={(e) =>
                onQtyChange(
                  Math.max(1, Math.min(lot.qty, parseInt(e.target.value, 10) || 1)),
                )
              }
              className="w-24 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <span className="text-xs text-gray-400">/ {lot.qty} available</span>
          </div>

          {/* Cargo-per-item override (item goods only) */}
          {isItem && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 flex items-center">
                Cargo / item
                <InfoTip text="Tons of cargo space consumed per item. Classic Traveller leaves this to the Referee. The value shown is the config default; override here for this purchase." />
                <span className="ml-1 text-amber-600 dark:text-amber-400 text-xs font-normal">
                  ⚠ Referee-defined
                </span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  step={0.001}
                  value={cargoPerItem}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    onCargoPerItemChange(isNaN(v) ? undefined : v);
                  }}
                  className="w-24 rounded-md border border-amber-300 dark:border-amber-700 bg-white dark:bg-gray-800 px-2 py-1 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <span className="text-xs text-gray-400">t/item</span>
                {cargoPerItemOverride !== undefined && (
                  <button
                    type="button"
                    onClick={() => onCargoPerItemChange(undefined)}
                    className="text-xs text-gray-400 hover:text-gray-600 underline"
                  >
                    reset
                  </button>
                )}
              </div>
              <span className="text-xs text-gray-400">
                config default: {good.defaultCargoPerItemTons ?? 0.01} t/item
              </span>
            </div>
          )}
        </div>
      )}

      {/* Resale result (when computed) */}
      {resaleResult && isSelected && (
        <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-3 bg-amber-50 dark:bg-amber-950/30 space-y-1">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
            <span>
              Sell %:{" "}
              <span className="font-semibold text-amber-700 dark:text-amber-400">
                {resaleResult.resalePct}%
              </span>
              <span className="ml-1 text-gray-400">
                (roll {resaleResult.resaleClampedRoll}, DM{" "}
                {signedDM(resaleResult.resaleDMTotal)})
              </span>
            </span>
            <span>
              Revenue:{" "}
              <span className="font-semibold text-gray-900 dark:text-gray-100">
                {formatCredits(resaleResult.resaleRevenue)}
              </span>
            </span>
            <span>
              Profit/Loss:{" "}
              <span
                className={`font-semibold ${
                  resaleResult.profit >= 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {resaleResult.profit >= 0 ? "+" : ""}
                {formatCredits(resaleResult.profit)}
              </span>
            </span>
          </div>
        </div>
      )}

      {/* Detail toggle */}
      <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-2">
        <button
          type="button"
          onClick={() => setShowDetail((v) => !v)}
          className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline focus:outline-none"
        >
          {showDetail ? "▲ Hide" : "▼ Show"} roll details
        </button>
        {showDetail && (
          <div className="mt-2 space-y-2 text-xs text-gray-600 dark:text-gray-400">
            {/* Goods roll */}
            <div className="flex gap-2 items-center">
              <span className="w-32 flex-shrink-0 font-medium">Goods roll (1d6)</span>
              <DiceDisplay dice={[lot.goodsRollDie]} />
              <span className="text-gray-400">→ {good.name}</span>
            </div>
            {/* Quantity roll */}
            <div className="flex gap-2 items-start">
              <span className="w-32 flex-shrink-0 font-medium">
                Qty ({good.quantityFormula})
              </span>
              <DiceDisplay dice={lot.qtyDice} />
              <span className="text-gray-400">
                = {sumDice(lot.qtyDice)} × {parseQuantityFormula(good.quantityFormula).multiplier} = {lot.qty} {isItem ? "items" : "t"}
              </span>
            </div>
            {/* Purchase DMs */}
            <div className="flex gap-2 items-start">
              <span className="w-32 flex-shrink-0 font-medium">Purchase DMs</span>
              <DMList items={lot.purchaseDMBreakdown} />
              <span className="text-gray-400 ml-1">
                total {signedDM(lot.purchaseDMTotal)}
              </span>
            </div>
            {/* Purchase value roll */}
            <div className="flex gap-2 items-center">
              <span className="w-32 flex-shrink-0 font-medium">Buy roll (2d6+DM)</span>
              <DiceDisplay dice={lot.purchaseValueDice} />
              <span className="text-gray-400">
                {sumDice(lot.purchaseValueDice)}{" "}
                {signedDM(lot.purchaseDMTotal)} = {lot.purchaseRawRoll}
                {lot.purchaseRawRoll !== lot.purchaseClampedRoll && (
                  <> → clamped {lot.purchaseClampedRoll}</>
                )}{" "}
                → {lot.purchasePct}%
              </span>
            </div>
            {/* Cargo note for item goods */}
            {isItem && (
              <div className="flex gap-2 items-start">
                <span className="w-32 flex-shrink-0 font-medium">Cargo / item</span>
                <span className="text-amber-600 dark:text-amber-400">
                  {cargoPerItem} t/item{" "}
                  {cargoPerItemOverride !== undefined
                    ? "(overridden)"
                    : "(config default)"}
                  {" "}— Referee-defined
                </span>
              </div>
            )}
            {/* Resale DMs (when computed) */}
            {resaleResult && (
              <>
                <div className="flex gap-2 items-start">
                  <span className="w-32 flex-shrink-0 font-medium">Resale DMs</span>
                  <DMList items={resaleResult.resaleDMBreakdown} />
                  <span className="text-gray-400 ml-1">
                    total {signedDM(resaleResult.resaleDMTotal)}
                  </span>
                </div>
                <div className="flex gap-2 items-center">
                  <span className="w-32 flex-shrink-0 font-medium">Sell roll (2d6+DM)</span>
                  <DiceDisplay dice={resaleResult.resaleValueDice} />
                  <span className="text-gray-400">
                    {sumDice(resaleResult.resaleValueDice)}{" "}
                    {signedDM(resaleResult.resaleDMTotal)} = {resaleResult.resaleRawRoll}
                    {resaleResult.resaleRawRoll !== resaleResult.resaleClampedRoll && (
                      <> → clamped {resaleResult.resaleClampedRoll}</>
                    )}{" "}
                    → {resaleResult.resalePct}%
                  </span>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
