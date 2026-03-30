// Classic Traveller Speculative Trade — Actual Value Table
//
// Maps a 2d6 roll result (after DMs, clamped to 2–12) to a price percentage.
// ─────────────────────────────────────────────────────────────────────────────
// PLACEHOLDER VALUES — replace with the exact table from your Classic Traveller
// rulebook (Book 2, Trade and Commerce section).  The multipliers below are
// commonly cited community reference values and are included so the feature
// works end-to-end without a rulebook in hand.

export interface ActualValueEntry {
  roll: number;
  purchasePct: number; // % of base price paid when buying
  resalePct: number;   // % of base price received when selling
}

// Roll: 2d6 result (clamped to 2–12) → purchase % / resale %
export const ACTUAL_VALUE_TABLE: ActualValueEntry[] = [
  { roll: 2,  purchasePct:  40, resalePct: 300 },
  { roll: 3,  purchasePct:  50, resalePct: 200 },
  { roll: 4,  purchasePct:  70, resalePct: 150 },
  { roll: 5,  purchasePct:  80, resalePct: 120 },
  { roll: 6,  purchasePct:  90, resalePct: 110 },
  { roll: 7,  purchasePct: 100, resalePct: 100 },
  { roll: 8,  purchasePct: 105, resalePct:  90 },
  { roll: 9,  purchasePct: 110, resalePct:  85 },
  { roll: 10, purchasePct: 115, resalePct:  80 },
  { roll: 11, purchasePct: 120, resalePct:  75 },
  { roll: 12, purchasePct: 130, resalePct:  70 },
];

/**
 * Look up a price percentage from the actual value table.
 * The roll is clamped to the table bounds (2–12) before lookup.
 */
export function lookupActualValue(
  roll: number,
  stage: "purchase" | "resale",
): number {
  const clamped = Math.max(2, Math.min(12, roll));
  const entry = ACTUAL_VALUE_TABLE.find((e) => e.roll === clamped);
  if (!entry) return 100;
  return stage === "purchase" ? entry.purchasePct : entry.resalePct;
}
