"use client";

import { useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Dice expression: roll `count` d6 and add `constant`. null means — (zero, no roll). */
type DiceExpr = { count: number; constant: number } | null;

type TravelZone = "Green" | "Amber" | "Red";

interface PassengerResult {
  expression: string;
  diceRolled: number[];
  baseResult: number;
  dm: number;
  finalCount: number;
}

interface CargoResult {
  expression: string;
  diceRolled: number[];
  baseCount: number;
  dm: number;
  finalCount: number;
  totalTons: number;
}

interface DmBreakdown {
  techDM: number;
  destPopPassengerDM: number;
  destPopCargoDM: number;
  zonePassengerDM: number;
  passengerDM: number;
  cargoDM: number;
  zoneConstraints: string[];
}

interface RollResult {
  passengers: {
    high: PassengerResult;
    middle: PassengerResult;
    low: PassengerResult;
  };
  cargo: {
    major: CargoResult;
    minor: CargoResult;
    incidental: CargoResult;
  };
  dms: DmBreakdown;
}

// ─── Classic Traveller Book 2 tables ─────────────────────────────────────────

/**
 * Passenger table indexed by origin population digit (0–10, where A=10).
 * Each row: [High, Middle, Low] dice expressions.
 * Base expressions include the table's constant modifier (e.g., "1D+2").
 * Additional DMs for destination pop, TL diff, and travel zone are applied on top.
 */
const PASSENGER_TABLE: [DiceExpr, DiceExpr, DiceExpr][] = [
  [null, null, null],                                                                       // 0
  [null, { count: 1, constant: -5 }, { count: 1, constant: -5 }],                         // 1
  [null, { count: 1, constant: -4 }, { count: 1, constant: -3 }],                         // 2
  [{ count: 1, constant: -5 }, { count: 1, constant: -3 }, { count: 2, constant: -6 }],   // 3
  [{ count: 1, constant: -4 }, { count: 2, constant: -6 }, { count: 3, constant: -8 }],   // 4
  [{ count: 1, constant: -3 }, { count: 3, constant: -8 }, { count: 3, constant: -6 }],   // 5
  [{ count: 1, constant: -2 }, { count: 3, constant: -6 }, { count: 4, constant: -8 }],   // 6
  [{ count: 1, constant: 0 }, { count: 3, constant: -4 }, { count: 4, constant: -6 }],    // 7
  [{ count: 1, constant: 1 }, { count: 3, constant: -2 }, { count: 5, constant: -8 }],    // 8
  [{ count: 1, constant: 2 }, { count: 3, constant: 0 }, { count: 5, constant: -6 }],     // 9
  [{ count: 1, constant: 3 }, { count: 3, constant: 2 }, { count: 5, constant: -4 }],     // A (10)
];

/**
 * Cargo (freight) table indexed by origin population digit (0–10, where A=10).
 * Each row: [Major, Minor, Incidental] lots dice expressions.
 * The constant in each expression is the table's own DM for that origin pop.
 * Example: pop 6 major = {count:1, constant:2} means "1D+2"
 * (confirmed by Book 2 example: roll 4, +2 from table, –4 dest pop, +3 tech = 5 major lots).
 */
const CARGO_TABLE: [DiceExpr, DiceExpr, DiceExpr][] = [
  [null, null, null],                                                                       // 0
  [null, null, { count: 1, constant: -3 }],                                               // 1
  [null, { count: 1, constant: -4 }, { count: 1, constant: 0 }],                         // 2
  [null, { count: 1, constant: -3 }, { count: 2, constant: -2 }],                        // 3
  [null, { count: 1, constant: 0 }, { count: 2, constant: 0 }],                          // 4
  [{ count: 1, constant: -3 }, { count: 2, constant: -2 }, { count: 3, constant: 0 }],   // 5
  [{ count: 1, constant: 2 }, { count: 2, constant: 0 }, { count: 3, constant: 0 }],     // 6
  [{ count: 1, constant: 4 }, { count: 3, constant: 0 }, { count: 4, constant: 0 }],     // 7
  [{ count: 2, constant: 0 }, { count: 3, constant: 2 }, { count: 4, constant: 2 }],     // 8
  [{ count: 2, constant: 2 }, { count: 4, constant: 0 }, { count: 5, constant: 0 }],     // 9
  [{ count: 2, constant: 4 }, { count: 4, constant: 2 }, { count: 5, constant: 2 }],     // A (10)
];

const CARGO_MULTIPLIERS: Record<"Major" | "Minor" | "Incidental", number> = {
  Major: 10,
  Minor: 5,
  Incidental: 1,
};

const PASSENGER_RATES = { high: 10_000, middle: 8_000, low: 1_000 } as const;
const CARGO_RATE = 1_000; // Cr per ton

// ─── Utility helpers ──────────────────────────────────────────────────────────

function rollD6(): number {
  return Math.floor(Math.random() * 6) + 1;
}

function rollDice(count: number): number[] {
  return Array.from({ length: count }, rollD6);
}

function exprString(expr: DiceExpr): string {
  if (!expr) return "—";
  const { count, constant } = expr;
  const base = `${count}D`;
  if (constant === 0) return base;
  return constant > 0 ? `${base}+${constant}` : `${base}${constant}`;
}

function formatCredits(amount: number): string {
  return `Cr${amount.toLocaleString()}`;
}

function popToIndex(pop: string): number {
  return pop === "A" ? 10 : parseInt(pop, 10);
}

// ─── DM computation ───────────────────────────────────────────────────────────

function computeDMs(
  destPopIdx: number,
  originTL: number,
  destTL: number,
  zone: TravelZone,
): DmBreakdown {
  const techDM = originTL - destTL;
  const destPopPassengerDM = destPopIdx <= 4 ? -3 : destPopIdx >= 8 ? 3 : 0;
  const destPopCargoDM = destPopIdx <= 4 ? -4 : destPopIdx >= 8 ? 1 : 0;
  const zonePassengerDM = zone === "Red" ? -12 : zone === "Amber" ? -6 : 0;

  const passengerDM = destPopPassengerDM + zonePassengerDM + techDM;
  const cargoDM = destPopCargoDM + techDM;

  const zoneConstraints: string[] = [];
  if (zone === "Red") {
    zoneConstraints.push("Red zone: Middle and Low passengers forced to 0");
    zoneConstraints.push("Red zone: All cargo forced to 0");
  } else if (zone === "Amber") {
    zoneConstraints.push("Amber zone: Major cargo forced to 0");
  }

  return {
    techDM,
    destPopPassengerDM,
    destPopCargoDM,
    zonePassengerDM,
    passengerDM,
    cargoDM,
    zoneConstraints,
  };
}

// ─── Roll functions ───────────────────────────────────────────────────────────

function rollPassengerClass(
  expr: DiceExpr,
  dm: number,
  forced0 = false,
): PassengerResult {
  if (forced0 || !expr) {
    return {
      expression: expr ? exprString(expr) : "—",
      diceRolled: [],
      baseResult: 0,
      dm,
      finalCount: 0,
    };
  }
  const diceRolled = rollDice(expr.count);
  const baseResult =
    diceRolled.reduce((a, b) => a + b, 0) + expr.constant;
  const finalCount = Math.max(0, baseResult + dm);
  return { expression: exprString(expr), diceRolled, baseResult, dm, finalCount };
}

function rollCargoType(
  type: "Major" | "Minor" | "Incidental",
  expr: DiceExpr,
  dm: number,
  forced0 = false,
): CargoResult {
  if (forced0 || !expr) {
    return {
      expression: expr ? exprString(expr) : "—",
      diceRolled: [],
      baseCount: 0,
      dm,
      finalCount: 0,
      totalTons: 0,
    };
  }
  const diceRolled = rollDice(expr.count);
  const baseCount =
    diceRolled.reduce((a, b) => a + b, 0) + expr.constant;
  const finalCount = Math.max(0, baseCount + dm);
  const multiplier = CARGO_MULTIPLIERS[type];
  const totalTons = Array.from({ length: finalCount }, rollD6).reduce(
    (sum, die) => sum + die * multiplier,
    0,
  );
  return {
    expression: exprString(expr),
    diceRolled,
    baseCount,
    dm,
    finalCount,
    totalTons,
  };
}

function performRoll(
  originPop: string,
  originTL: number,
  destPop: string,
  destTL: number,
  zone: TravelZone,
): RollResult {
  const originIdx = popToIndex(originPop);
  const destIdx = popToIndex(destPop);
  const dms = computeDMs(destIdx, originTL, destTL, zone);

  const [highExpr, middleExpr, lowExpr] = PASSENGER_TABLE[originIdx];
  const [majorExpr, minorExpr, incidentalExpr] = CARGO_TABLE[originIdx];

  const isRed = zone === "Red";
  const isAmber = zone === "Amber";

  return {
    passengers: {
      high: rollPassengerClass(highExpr, dms.passengerDM),
      middle: rollPassengerClass(middleExpr, dms.passengerDM, isRed),
      low: rollPassengerClass(lowExpr, dms.passengerDM, isRed),
    },
    cargo: {
      major: rollCargoType("Major", majorExpr, dms.cargoDM, isRed || isAmber),
      minor: rollCargoType("Minor", minorExpr, dms.cargoDM, isRed),
      incidental: rollCargoType(
        "Incidental",
        incidentalExpr,
        dms.cargoDM,
        isRed,
      ),
    },
    dms,
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const POP_OPTIONS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "A"];

function WorldInputCard({
  title,
  pop,
  onPopChange,
  tl,
  onTlChange,
  zone,
  onZoneChange,
}: {
  title: string;
  pop: string;
  onPopChange: (v: string) => void;
  tl: number;
  onTlChange: (v: number) => void;
  zone?: TravelZone;
  onZoneChange?: (v: TravelZone) => void;
}) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
        {title}
      </h3>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
            Population
          </label>
          <select
            value={pop}
            onChange={(e) => onPopChange(e.target.value)}
            className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            {POP_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
            Tech Level
          </label>
          <select
            value={tl}
            onChange={(e) => onTlChange(parseInt(e.target.value, 10))}
            className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            {Array.from({ length: 21 }, (_, i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </div>
      </div>
      {zone !== undefined && onZoneChange && (
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
            Travel Zone
          </label>
          <div className="flex gap-2">
            {(["Green", "Amber", "Red"] as TravelZone[]).map((z) => {
              const colours: Record<TravelZone, string> = {
                Green:
                  "border-green-400 bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-300 dark:border-green-700",
                Amber:
                  "border-amber-400 bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-700",
                Red: "border-red-400 bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-300 dark:border-red-700",
              };
              const selected = zone === z;
              return (
                <button
                  key={z}
                  type="button"
                  onClick={() => onZoneChange(z)}
                  className={`flex-1 rounded-md border px-3 py-1.5 text-xs font-semibold transition-all ${
                    selected
                      ? colours[z] + " ring-2 ring-offset-1 ring-current"
                      : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 hover:border-gray-400"
                  }`}
                >
                  {z}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function DiceDisplay({ dice }: { dice: number[] }) {
  if (dice.length === 0) return <span className="text-gray-400">—</span>;
  return (
    <span className="inline-flex gap-1">
      {dice.map((d, i) => (
        <span
          key={i}
          className="inline-flex items-center justify-center w-6 h-6 rounded bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 text-xs font-bold"
        >
          {d}
        </span>
      ))}
    </span>
  );
}

function PassengerBreakdownRow({
  label,
  result,
}: {
  label: string;
  result: PassengerResult;
}) {
  return (
    <tr className={result.finalCount === 0 ? "opacity-50" : ""}>
      <td className="py-1.5 pr-3 text-sm font-medium text-gray-800 dark:text-gray-200">
        {label}
      </td>
      <td className="py-1.5 pr-3 text-xs text-gray-500 dark:text-gray-400 font-mono">
        {result.expression}
      </td>
      <td className="py-1.5 pr-3">
        <DiceDisplay dice={result.diceRolled} />
      </td>
      <td className="py-1.5 pr-3 text-sm text-right text-gray-600 dark:text-gray-400">
        {result.diceRolled.length > 0
          ? result.baseResult
          : "—"}
      </td>
      <td className="py-1.5 pr-3 text-sm text-right text-gray-600 dark:text-gray-400">
        {result.dm >= 0 ? `+${result.dm}` : result.dm}
      </td>
      <td className="py-1.5 text-sm text-right font-bold text-amber-700 dark:text-amber-400">
        {result.finalCount}
      </td>
    </tr>
  );
}

function CargoBreakdownRow({
  label,
  result,
}: {
  label: string;
  result: CargoResult;
}) {
  return (
    <tr className={result.finalCount === 0 ? "opacity-50" : ""}>
      <td className="py-1.5 pr-3 text-sm font-medium text-gray-800 dark:text-gray-200">
        {label}
      </td>
      <td className="py-1.5 pr-3 text-xs text-gray-500 dark:text-gray-400 font-mono">
        {result.expression}
      </td>
      <td className="py-1.5 pr-3">
        <DiceDisplay dice={result.diceRolled} />
      </td>
      <td className="py-1.5 pr-3 text-sm text-right text-gray-600 dark:text-gray-400">
        {result.diceRolled.length > 0 ? result.baseCount : "—"}
      </td>
      <td className="py-1.5 pr-3 text-sm text-right text-gray-600 dark:text-gray-400">
        {result.dm >= 0 ? `+${result.dm}` : result.dm}
      </td>
      <td className="py-1.5 pr-3 text-sm text-right font-bold text-amber-700 dark:text-amber-400">
        {result.finalCount}
      </td>
      <td className="py-1.5 text-sm text-right text-gray-600 dark:text-gray-400">
        {result.totalTons} t
      </td>
    </tr>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PassengerCargoRoller() {
  const [originPop, setOriginPop] = useState("6");
  const [originTL, setOriginTL] = useState(8);
  const [destPop, setDestPop] = useState("5");
  const [destTL, setDestTL] = useState(7);
  const [destZone, setDestZone] = useState<TravelZone>("Green");
  const [result, setResult] = useState<RollResult | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  function handleRoll() {
    setResult(performRoll(originPop, originTL, destPop, destTL, destZone));
    setShowDetail(false);
  }

  const totalPax = result
    ? result.passengers.high.finalCount +
      result.passengers.middle.finalCount +
      result.passengers.low.finalCount
    : 0;

  const totalCargoTons = result
    ? result.cargo.major.totalTons +
      result.cargo.minor.totalTons +
      result.cargo.incidental.totalTons
    : 0;

  const paxRevenue = result
    ? result.passengers.high.finalCount * PASSENGER_RATES.high +
      result.passengers.middle.finalCount * PASSENGER_RATES.middle +
      result.passengers.low.finalCount * PASSENGER_RATES.low
    : 0;

  const cargoRevenue = totalCargoTons * CARGO_RATE;
  const totalRevenue = paxRevenue + cargoRevenue;

  return (
    <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-indigo-700 px-6 py-3">
        <h2 className="text-lg font-semibold text-white">
          🎲 Roll Available Passengers &amp; Cargo
        </h2>
      </div>

      <div className="p-6 space-y-6">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Enter the origin and destination world specs, then click Roll to
          determine how many passengers and how much cargo is available for this
          jump. Modifiers for destination population, tech level difference, and
          travel zone are applied automatically.
        </p>

        {/* World input form */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <WorldInputCard
            title="🌍 Origin World"
            pop={originPop}
            onPopChange={setOriginPop}
            tl={originTL}
            onTlChange={setOriginTL}
          />
          <WorldInputCard
            title="🌏 Destination World"
            pop={destPop}
            onPopChange={setDestPop}
            tl={destTL}
            onTlChange={setDestTL}
            zone={destZone}
            onZoneChange={setDestZone}
          />
        </div>

        {/* Roll button */}
        <button
          type="button"
          onClick={handleRoll}
          className="w-full sm:w-auto px-8 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-base transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          🎲 Roll Passengers &amp; Cargo
        </button>

        {/* Results */}
        {result && (
          <div className="space-y-5">
            {/* DM summary */}
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Applied Modifiers (DMs)
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                {[
                  {
                    label: "Tech DM",
                    value: result.dms.techDM,
                    hint: `TL ${originTL} − TL ${destTL}`,
                  },
                  {
                    label: "Dest Pop DM (pax)",
                    value: result.dms.destPopPassengerDM,
                    hint: `Pop ${destPop}`,
                  },
                  {
                    label: "Dest Pop DM (cargo)",
                    value: result.dms.destPopCargoDM,
                    hint: `Pop ${destPop}`,
                  },
                  {
                    label: "Zone DM (pax)",
                    value: result.dms.zonePassengerDM,
                    hint: destZone,
                  },
                  {
                    label: "Total Pax DM",
                    value: result.dms.passengerDM,
                    hint: "combined",
                  },
                  {
                    label: "Total Cargo DM",
                    value: result.dms.cargoDM,
                    hint: "combined",
                  },
                ].map(({ label, value, hint }) => (
                  <div
                    key={label}
                    className="flex items-center justify-between rounded bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-1.5"
                  >
                    <span className="text-gray-600 dark:text-gray-400">
                      {label}
                      <span className="ml-1 text-gray-400 dark:text-gray-500">
                        ({hint})
                      </span>
                    </span>
                    <span
                      className={`font-bold ml-2 ${
                        value > 0
                          ? "text-green-600 dark:text-green-400"
                          : value < 0
                            ? "text-red-600 dark:text-red-400"
                            : "text-gray-500"
                      }`}
                    >
                      {value >= 0 ? `+${value}` : value}
                    </span>
                  </div>
                ))}
              </div>
              {result.dms.zoneConstraints.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {result.dms.zoneConstraints.map((c) => (
                    <li
                      key={c}
                      className="text-xs font-medium text-red-600 dark:text-red-400 flex items-center gap-1"
                    >
                      ⚠ {c}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Passengers */}
              <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 p-4 space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                  🚀 Passengers
                </h3>
                <div className="space-y-1">
                  {[
                    {
                      label: "High",
                      count: result.passengers.high.finalCount,
                      rate: PASSENGER_RATES.high,
                    },
                    {
                      label: "Middle",
                      count: result.passengers.middle.finalCount,
                      rate: PASSENGER_RATES.middle,
                    },
                    {
                      label: "Low",
                      count: result.passengers.low.finalCount,
                      rate: PASSENGER_RATES.low,
                    },
                  ].map(({ label, count, rate }) => (
                    <div
                      key={label}
                      className="flex justify-between text-sm"
                    >
                      <span className="text-gray-600 dark:text-gray-400">
                        {label}
                      </span>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">
                        {count}
                        <span className="text-xs font-normal text-gray-400 ml-1">
                          ×{formatCredits(rate)}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-amber-200 dark:border-amber-800 pt-2 flex justify-between text-sm font-bold text-amber-700 dark:text-amber-400">
                  <span>Total ({totalPax} pax)</span>
                  <span>{formatCredits(paxRevenue)}</span>
                </div>
              </div>

              {/* Cargo */}
              <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 p-4 space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                  📦 Cargo
                </h3>
                <div className="space-y-1">
                  {[
                    { label: "Major", cargo: result.cargo.major },
                    { label: "Minor", cargo: result.cargo.minor },
                    { label: "Incidental", cargo: result.cargo.incidental },
                  ].map(({ label, cargo }) => (
                    <div
                      key={label}
                      className="flex justify-between text-sm"
                    >
                      <span className="text-gray-600 dark:text-gray-400">
                        {label}
                      </span>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">
                        {cargo.totalTons} t
                      </span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-amber-200 dark:border-amber-800 pt-2 flex justify-between text-sm font-bold text-amber-700 dark:text-amber-400">
                  <span>Total ({totalCargoTons} t)</span>
                  <span>{formatCredits(cargoRevenue)}</span>
                </div>
              </div>

              {/* Revenue */}
              <div className="rounded-lg border-2 border-indigo-400 dark:border-indigo-600 bg-indigo-50 dark:bg-indigo-950 p-4 space-y-2 flex flex-col justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-400">
                  💰 Potential Revenue
                </h3>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">
                      Passengers
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      {formatCredits(paxRevenue)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">
                      Cargo
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      {formatCredits(cargoRevenue)}
                    </span>
                  </div>
                </div>
                <div className="border-t border-indigo-200 dark:border-indigo-800 pt-2 flex justify-between font-bold text-indigo-700 dark:text-indigo-300">
                  <span>Total</span>
                  <span className="text-lg">{formatCredits(totalRevenue)}</span>
                </div>
              </div>
            </div>

            {/* Detailed breakdown toggle */}
            <button
              type="button"
              onClick={() => setShowDetail((v) => !v)}
              className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline focus:outline-none"
            >
              {showDetail
                ? "▲ Hide dice breakdown"
                : "▼ Show dice breakdown"}
            </button>

            {showDetail && (
              <div className="space-y-4">
                {/* Passenger breakdown table */}
                <div className="overflow-x-auto">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                    Passenger Roll Breakdown
                  </p>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="pb-1 text-left text-gray-500 dark:text-gray-400">
                          Class
                        </th>
                        <th className="pb-1 text-left text-gray-500 dark:text-gray-400">
                          Expr
                        </th>
                        <th className="pb-1 text-left text-gray-500 dark:text-gray-400">
                          Dice
                        </th>
                        <th className="pb-1 text-right text-gray-500 dark:text-gray-400">
                          Base
                        </th>
                        <th className="pb-1 text-right text-gray-500 dark:text-gray-400">
                          DM
                        </th>
                        <th className="pb-1 text-right text-gray-500 dark:text-gray-400">
                          Final
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      <PassengerBreakdownRow
                        label="High"
                        result={result.passengers.high}
                      />
                      <PassengerBreakdownRow
                        label="Middle"
                        result={result.passengers.middle}
                      />
                      <PassengerBreakdownRow
                        label="Low"
                        result={result.passengers.low}
                      />
                    </tbody>
                  </table>
                </div>

                {/* Cargo breakdown table */}
                <div className="overflow-x-auto">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                    Cargo Roll Breakdown
                  </p>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="pb-1 text-left text-gray-500 dark:text-gray-400">
                          Type
                        </th>
                        <th className="pb-1 text-left text-gray-500 dark:text-gray-400">
                          Expr
                        </th>
                        <th className="pb-1 text-left text-gray-500 dark:text-gray-400">
                          Dice
                        </th>
                        <th className="pb-1 text-right text-gray-500 dark:text-gray-400">
                          Base
                        </th>
                        <th className="pb-1 text-right text-gray-500 dark:text-gray-400">
                          DM
                        </th>
                        <th className="pb-1 text-right text-gray-500 dark:text-gray-400">
                          Count
                        </th>
                        <th className="pb-1 text-right text-gray-500 dark:text-gray-400">
                          Tons
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      <CargoBreakdownRow
                        label="Major"
                        result={result.cargo.major}
                      />
                      <CargoBreakdownRow
                        label="Minor"
                        result={result.cargo.minor}
                      />
                      <CargoBreakdownRow
                        label="Incidental"
                        result={result.cargo.incidental}
                      />
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
