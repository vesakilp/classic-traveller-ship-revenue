// Classic Traveller Speculative Trade — Trade Goods Configuration
//
// ─────────────────────────────────────────────────────────────────────────────
// PLACEHOLDER DATASET — populate with the actual trade goods table from your
// Classic Traveller rulebook (Book 2, Trade and Commerce section).
// Three sample goods are included so the feature works end-to-end.
// ─────────────────────────────────────────────────────────────────────────────
//
// unitType:
//   "ton"  — quantity is in displacement tons; occupies cargo space 1:1.
//   "item" — quantity is a count of discrete items.  Cargo space is calculated
//            as: itemCount × cargoPerItemTons.  Classic CT leaves exact tonnage
//            for per-item goods to the Referee; override at purchase time.
//
// quantityFormula: dice expression string parsed at roll time.
//   Supported formats: "1D6", "2D6", "1D6x10", "2D6x5", "1D6+5", "2D6x10+5"
//   (case-insensitive; "D" means d6).
//
// purchaseDMRules / resaleDMRules:
//   Array of { tag, dm } pairs.  The DM is added when the origin world (for
//   purchase) or destination world (for resale) has the specified trade tag.
//   Tags: "Ag" | "Na" | "In" | "Ni" | "Ri" | "Po"

export type TradeTag = "Ag" | "Na" | "In" | "Ni" | "Ri" | "Po";

export interface TagDMRule {
  tag: TradeTag;
  dm: number;
}

export interface TradeGood {
  id: string;
  name: string;
  basePrice: number;            // Credits per ton (or per item for "item" type)
  unitType: "ton" | "item";
  quantityFormula: string;      // e.g. "1D6x10", "2D6", "1D6x5"
  purchaseDMRules: TagDMRule[]; // DMs applied at origin when buying
  resaleDMRules: TagDMRule[];   // DMs applied at destination when selling
  defaultCargoPerItemTons?: number; // Only relevant when unitType="item"
}

// ─── Placeholder trade goods ──────────────────────────────────────────────────

export const TRADE_GOODS: TradeGood[] = [
  // ── Ton-based goods ────────────────────────────────────────────────────────
  {
    id: "common-electronics",
    name: "Common Electronics",
    basePrice: 20_000,
    unitType: "ton",
    quantityFormula: "2D6x5",
    purchaseDMRules: [
      { tag: "In", dm: +2 },
      { tag: "Ri", dm: +2 },
    ],
    resaleDMRules: [
      { tag: "Ni", dm: +3 },
      { tag: "Ag", dm: +2 },
    ],
  },
  {
    id: "common-ore",
    name: "Common Ore",
    basePrice: 1_000,
    unitType: "ton",
    quantityFormula: "1D6x10",
    purchaseDMRules: [
      { tag: "Na", dm: +2 },
    ],
    resaleDMRules: [
      { tag: "In", dm: +3 },
      { tag: "Ni", dm: +1 },
    ],
  },
  {
    id: "agricultural-products",
    name: "Agricultural Products",
    basePrice: 3_000,
    unitType: "ton",
    quantityFormula: "3D6x5",
    purchaseDMRules: [
      { tag: "Ag", dm: +4 },
    ],
    resaleDMRules: [
      { tag: "In", dm: +3 },
      { tag: "Na", dm: +2 },
      { tag: "Ni", dm: +1 },
    ],
  },
  // ── Item-based good (cargo-per-item is Referee-defined) ────────────────────
  {
    id: "crystals-gems",
    name: "Crystals & Gems",
    basePrice: 20_000,
    unitType: "item",
    quantityFormula: "1D6",
    // defaultCargoPerItemTons is a placeholder; adjust to your campaign ruling.
    defaultCargoPerItemTons: 0.01,
    purchaseDMRules: [
      { tag: "Na", dm: +2 },
      { tag: "Ni", dm: +1 },
    ],
    resaleDMRules: [
      { tag: "Ri", dm: +3 },
      { tag: "In", dm: +2 },
    ],
  },
];
