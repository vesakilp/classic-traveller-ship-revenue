"use client";

import { useState, useEffect, useRef } from "react";
import { ShipSpecs } from "../types";
import {
  parseUWP,
  formatUWP,
  randomUWP,
  uwpPopulation,
  uwpTechLevel,
  starportDescription,
  sizeDescription,
  atmosphereDescription,
  hydrographicsDescription,
  populationDescription,
  governmentDescription,
  lawLevelDescription,
  techLevelDescription,
} from "../utils/uwp";
import { deriveTradeTagsFromUWP, tradeTagList } from "../utils/tradeTags";

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

interface CargoLot {
  id: string;
  type: "Major" | "Minor" | "Incidental";
  sizeDie: number;
  tons: number;
}

interface CargoResult {
  expression: string;
  diceRolled: number[];
  baseCount: number;
  dm: number;
  finalCount: number;
  lots: CargoLot[];
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

interface AcceptedPassengers {
  high: number;
  middle: number;
  low: number;
}

// ─── Classic Traveller Book 2 tables ─────────────────────────────────────────

const PASSENGER_TABLE: [DiceExpr, DiceExpr, DiceExpr][] = [
  [null, null, null],
  [null, { count: 1, constant: -5 }, { count: 1, constant: -5 }],
  [null, { count: 1, constant: -4 }, { count: 1, constant: -3 }],
  [{ count: 1, constant: -5 }, { count: 1, constant: -3 }, { count: 2, constant: -6 }],
  [{ count: 1, constant: -4 }, { count: 2, constant: -6 }, { count: 3, constant: -8 }],
  [{ count: 1, constant: -3 }, { count: 3, constant: -8 }, { count: 3, constant: -6 }],
  [{ count: 1, constant: -2 }, { count: 3, constant: -6 }, { count: 4, constant: -8 }],
  [{ count: 1, constant: 0 }, { count: 3, constant: -4 }, { count: 4, constant: -6 }],
  [{ count: 1, constant: 1 }, { count: 3, constant: -2 }, { count: 5, constant: -8 }],
  [{ count: 1, constant: 2 }, { count: 3, constant: 0 }, { count: 5, constant: -6 }],
  [{ count: 1, constant: 3 }, { count: 3, constant: 2 }, { count: 5, constant: -4 }],
];

const CARGO_TABLE: [DiceExpr, DiceExpr, DiceExpr][] = [
  [null, null, null],
  [null, null, { count: 1, constant: -3 }],
  [null, { count: 1, constant: -4 }, { count: 1, constant: 0 }],
  [null, { count: 1, constant: -3 }, { count: 2, constant: -2 }],
  [null, { count: 1, constant: 0 }, { count: 2, constant: 0 }],
  [{ count: 1, constant: -3 }, { count: 2, constant: -2 }, { count: 3, constant: 0 }],
  [{ count: 1, constant: 2 }, { count: 2, constant: 0 }, { count: 3, constant: 0 }],
  [{ count: 1, constant: 4 }, { count: 3, constant: 0 }, { count: 4, constant: 0 }],
  [{ count: 2, constant: 0 }, { count: 3, constant: 2 }, { count: 4, constant: 2 }],
  [{ count: 2, constant: 2 }, { count: 4, constant: 0 }, { count: 5, constant: 0 }],
  [{ count: 2, constant: 4 }, { count: 4, constant: 2 }, { count: 5, constant: 2 }],
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

// ─── Auto-select helpers ──────────────────────────────────────────────────────

/**
 * Select cargo lots to maximise accepted tonnage within `cargoSpace`.
 * Uses a greedy descending-sort approach (largest lots first).
 * This is an approximation — the true 0/1 knapsack optimum may differ
 * for some distributions, but is close enough for typical game scenarios.
 * If cargoSpace is 0 (no constraint), all lots are accepted.
 */
function autoSelectLots(lots: CargoLot[], cargoSpace: number): Set<string> {
  if (cargoSpace <= 0) {
    return new Set(lots.map((l) => l.id));
  }
  const sorted = [...lots].sort((a, b) => b.tons - a.tons);
  const selected = new Set<string>();
  let remaining = cargoSpace;
  for (const lot of sorted) {
    if (lot.tons <= remaining) {
      selected.add(lot.id);
      remaining -= lot.tons;
    }
  }
  return selected;
}

/**
 * Auto-distribute rolled passengers to ship accommodation for best revenue.
 * High passengers (Cr10,000) fill staterooms first; Middle (Cr8,000) take
 * any remaining staterooms; Low (Cr1,000) fill low berths.
 * If a capacity is 0 (not configured) there is no constraint for that class.
 */
function autoDistributePassengers(
  result: RollResult,
  specs: ShipSpecs,
): AcceptedPassengers {
  const h =
    specs.staterooms > 0
      ? Math.min(result.passengers.high.finalCount, specs.staterooms)
      : result.passengers.high.finalCount;
  const m =
    specs.staterooms > 0
      ? Math.min(
          result.passengers.middle.finalCount,
          Math.max(0, specs.staterooms - h),
        )
      : result.passengers.middle.finalCount;
  const l =
    specs.lowBerths > 0
      ? Math.min(result.passengers.low.finalCount, specs.lowBerths)
      : result.passengers.low.finalCount;
  return { high: h, middle: m, low: l };
}

/** Returns true if accepting `lot` would push accepted tonnage over `space`. */
function lotExceedsSpace(
  lot: CargoLot,
  currentTons: number,
  space: number,
): boolean {
  return space > 0 && currentTons + lot.tons > space;
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
  const baseResult = diceRolled.reduce((a, b) => a + b, 0) + expr.constant;
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
      lots: [],
      totalTons: 0,
    };
  }
  const diceRolled = rollDice(expr.count);
  const baseCount = diceRolled.reduce((a, b) => a + b, 0) + expr.constant;
  const finalCount = Math.max(0, baseCount + dm);
  const multiplier = CARGO_MULTIPLIERS[type];
  const lots: CargoLot[] = Array.from({ length: finalCount }, (_, i) => {
    const sizeDie = rollD6();
    return { id: `${type.toLowerCase()}-${i}`, type, sizeDie, tons: sizeDie * multiplier };
  });
  const totalTons = lots.reduce((sum, lot) => sum + lot.tons, 0);
  return { expression: exprString(expr), diceRolled, baseCount, dm, finalCount, lots, totalTons };
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
      incidental: rollCargoType("Incidental", incidentalExpr, dms.cargoDM, isRed),
    },
    dms,
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const [tipStyle, setTipStyle] = useState<React.CSSProperties>({});
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, { capture: true, passive: true });
    return () => window.removeEventListener("scroll", close, { capture: true });
  }, [open]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const TIP_W = 256; // w-64
      const GAP = 6;
      let left = rect.right + GAP;
      if (left + TIP_W > window.innerWidth - 8) {
        left = rect.left - TIP_W - GAP;
      }
      if (left < 8) left = 8;
      const top = Math.max(8, Math.min(rect.top, window.innerHeight - 80));
      const maxHeight = window.innerHeight - top - 12;
      setTipStyle({ position: "fixed", top, left, maxHeight, overflowY: "auto", zIndex: 50 });
    }
    setOpen((v) => !v);
  };

  return (
    <span className="relative inline-block align-middle">
      <button
        ref={btnRef}
        type="button"
        onClick={handleToggle}
        className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-indigo-100 hover:text-indigo-600 dark:hover:bg-indigo-900 dark:hover:text-indigo-300 text-xs font-bold focus:outline-none transition-colors"
        aria-label="More information"
      >
        ?
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0"
            style={{ zIndex: 49 }} /* sits below tooltip (z:50 in tipStyle) */
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            style={tipStyle}
            className="w-64 rounded-lg bg-gray-900 text-white text-xs p-3 shadow-xl"
            role="tooltip"
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute top-0 right-0 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white"
              aria-label="Close"
            >
              ✕
            </button>
            <p className="pr-6">{text}</p>
          </div>
        </>
      )}
    </span>
  );
}

// ─── UWP world-input sub-components ──────────────────────────────────────────

function UWPCharRow({
  label,
  code,
  description,
}: {
  label: string;
  code: string;
  description: string;
}) {
  return (
    <div className="flex items-center px-3 py-1.5 gap-3 text-xs">
      <span className="w-24 text-gray-500 dark:text-gray-400 font-medium flex-shrink-0">
        {label}
      </span>
      <span className="w-5 text-center font-mono font-bold text-amber-700 dark:text-amber-400 flex-shrink-0">
        {code}
      </span>
      <span className="text-gray-700 dark:text-gray-300">{description}</span>
    </div>
  );
}

function WorldUWPCard({
  title,
  uwp,
  onUWPChange,
  zone,
  onZoneChange,
}: {
  title: string;
  uwp: string;
  onUWPChange: (v: string) => void;
  zone?: TravelZone;
  onZoneChange?: (v: TravelZone) => void;
}) {
  const [open, setOpen] = useState(false);
  const parsed = parseUWP(uwp);
  const isValid = parsed !== null;

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
        {title}
      </h3>

      {/* UWP text input */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-600 dark:text-gray-400 flex items-center">
          UWP
          <InfoTip text="Universal World Profile — 7-character world code followed by tech level. Format: Starport Size Atmo Hydro Pop Gov Law-TL. Example: A666677-8." />
        </label>
        <input
          type="text"
          value={uwp}
          onChange={(e) => onUWPChange(e.target.value.toUpperCase())}
          placeholder="e.g. A666677-8"
          maxLength={9}
          className={`rounded-md border bg-white dark:bg-gray-900 px-3 py-2 text-sm font-mono text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500 ${
            isValid || uwp.length === 0
              ? "border-gray-300 dark:border-gray-600"
              : "border-red-400 dark:border-red-600"
          }`}
        />
        {!isValid && uwp.length > 0 && (
          <p className="text-xs text-red-500 dark:text-red-400">
            Invalid UWP — expected format like A666677-8
          </p>
        )}
      </div>

      {/* Accordion: world characteristics */}
      <div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline focus:outline-none flex items-center gap-1"
        >
          {open ? "▲ Hide" : "▼ Show"} world characteristics
        </button>

        {open && (
          <div className="mt-2 rounded-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800">
            {parsed ? (
              <>
                <UWPCharRow
                  label="Starport"
                  code={parsed.starport}
                  description={starportDescription(parsed.starport)}
                />
                <UWPCharRow
                  label="Size"
                  code={parsed.size}
                  description={sizeDescription(parsed.size)}
                />
                <UWPCharRow
                  label="Atmosphere"
                  code={parsed.atmosphere}
                  description={atmosphereDescription(parsed.atmosphere)}
                />
                <UWPCharRow
                  label="Hydrographics"
                  code={parsed.hydrographics}
                  description={hydrographicsDescription(parsed.hydrographics)}
                />
                <UWPCharRow
                  label="Population"
                  code={parsed.population}
                  description={populationDescription(parsed.population)}
                />
                <UWPCharRow
                  label="Government"
                  code={parsed.government}
                  description={governmentDescription(parsed.government)}
                />
                <UWPCharRow
                  label="Law Level"
                  code={parsed.lawLevel}
                  description={lawLevelDescription(parsed.lawLevel)}
                />
                <UWPCharRow
                  label="Tech Level"
                  code={parsed.techLevel}
                  description={techLevelDescription(parsed.techLevel)}
                />
                {/* Trade tags derived from UWP */}
                <div className="flex items-center px-3 py-1.5 gap-3 text-xs">
                  <span className="w-24 text-gray-500 dark:text-gray-400 font-medium flex-shrink-0">
                    Trade Tags
                  </span>
                  <span className="flex flex-wrap gap-1">
                    {(() => {
                      const tags = deriveTradeTagsFromUWP(parsed);
                      const list = tradeTagList(tags);
                      if (list.length === 0)
                        return (
                          <span className="text-gray-400 dark:text-gray-500 italic">
                            none
                          </span>
                        );
                      const tagColors: Record<string, string> = {
                        Ag: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
                        Na: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
                        In: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
                        Ni: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
                        Ri: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
                        Po: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
                      };
                      return list.map((t) => (
                        <span
                          key={t}
                          className={`inline-block px-1.5 py-0.5 rounded text-xs font-semibold ${tagColors[t] ?? "bg-gray-100 text-gray-600"}`}
                        >
                          {t}
                        </span>
                      ));
                    })()}
                  </span>
                </div>
              </>
            ) : (
              <p className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500 italic">
                Enter a valid UWP to see world characteristics.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Travel Zone selector — destination only */}
      {zone !== undefined && onZoneChange && (
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400 flex items-center">
            Travel Zone
            <InfoTip text="Green: normal travel. Amber: caution advised — major cargo unavailable and –6 DM to passenger rolls. Red: interdicted — all cargo unavailable, Middle/Low passengers forced to 0, –12 DM to High passenger roll." />
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

function PassengerBreakdownRow({ label, result }: { label: string; result: PassengerResult }) {
  return (
    <tr className={result.finalCount === 0 ? "opacity-50" : ""}>
      <td className="py-1.5 pr-3 text-sm font-medium text-gray-800 dark:text-gray-200">{label}</td>
      <td className="py-1.5 pr-3 text-xs text-gray-500 dark:text-gray-400 font-mono">{result.expression}</td>
      <td className="py-1.5 pr-3"><DiceDisplay dice={result.diceRolled} /></td>
      <td className="py-1.5 pr-3 text-sm text-right text-gray-600 dark:text-gray-400">
        {result.diceRolled.length > 0 ? result.baseResult : "—"}
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

function CargoBreakdownRow({ label, result }: { label: string; result: CargoResult }) {
  return (
    <tr className={result.finalCount === 0 ? "opacity-50" : ""}>
      <td className="py-1.5 pr-3 text-sm font-medium text-gray-800 dark:text-gray-200">{label}</td>
      <td className="py-1.5 pr-3 text-xs text-gray-500 dark:text-gray-400 font-mono">{result.expression}</td>
      <td className="py-1.5 pr-3"><DiceDisplay dice={result.diceRolled} /></td>
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

const DEFAULT_ACCEPTED_PASSENGERS: AcceptedPassengers = { high: 0, middle: 0, low: 0 };

export default function PassengerCargoRoller({
  shipSpecs,
  originUWP,
  onOriginUWPChange,
  destUWP,
  onDestUWPChange,
  destZone,
  onDestZoneChange,
  onAcceptedTonsChange,
}: {
  shipSpecs: ShipSpecs;
  originUWP: string;
  onOriginUWPChange: (v: string) => void;
  destUWP: string;
  onDestUWPChange: (v: string) => void;
  destZone: TravelZone;
  onDestZoneChange: (v: TravelZone) => void;
  onAcceptedTonsChange?: (tons: number) => void;
}) {
  // Derived values parsed from UWP strings — used in roll calculations
  const originParsed = parseUWP(originUWP);
  const destParsed = parseUWP(destUWP);
  const originPop = originParsed ? uwpPopulation(originParsed) : "6";
  const originTL = originParsed ? uwpTechLevel(originParsed) : 8;
  const destPop = destParsed ? uwpPopulation(destParsed) : "5";
  const destTL = destParsed ? uwpTechLevel(destParsed) : 7;
  const canRoll = originParsed !== null && destParsed !== null;
  const [result, setResult] = useState<RollResult | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [acceptedPassengers, setAcceptedPassengers] = useState<AcceptedPassengers>(DEFAULT_ACCEPTED_PASSENGERS);
  const [acceptedLotIds, setAcceptedLotIds] = useState<Set<string>>(new Set());

  function handleRoll() {
    const newResult = performRoll(originPop, originTL, destPop, destTL, destZone);
    setResult(newResult);
    // Auto-distribute passengers to accommodation (High first for best revenue)
    setAcceptedPassengers(autoDistributePassengers(newResult, shipSpecs));
    // Auto-select cargo lots to best fill cargo space from ship specs
    const allNewLots = [
      ...newResult.cargo.major.lots,
      ...newResult.cargo.minor.lots,
      ...newResult.cargo.incidental.lots,
    ];
    setAcceptedLotIds(autoSelectLots(allNewLots, shipSpecs.cargoSpace));
    // Leave showDetail unchanged
  }

  function handleRandomize() {
    onOriginUWPChange(formatUWP(randomUWP()));
    onDestUWPChange(formatUWP(randomUWP()));
  }

  const allLots: CargoLot[] = result
    ? [
        ...result.cargo.major.lots,
        ...result.cargo.minor.lots,
        ...result.cargo.incidental.lots,
      ]
    : [];

  // Max accepted for each passenger class given current state
  function maxHighAccepted(): number {
    if (!result) return 0;
    const fromRoll = result.passengers.high.finalCount;
    if (shipSpecs.staterooms <= 0) return fromRoll;
    return Math.min(fromRoll, Math.max(0, shipSpecs.staterooms - acceptedPassengers.middle));
  }
  function maxMiddleAccepted(): number {
    if (!result) return 0;
    const fromRoll = result.passengers.middle.finalCount;
    if (shipSpecs.staterooms <= 0) return fromRoll;
    return Math.min(fromRoll, Math.max(0, shipSpecs.staterooms - acceptedPassengers.high));
  }
  function maxLowAccepted(): number {
    if (!result) return 0;
    const fromRoll = result.passengers.low.finalCount;
    if (shipSpecs.lowBerths <= 0) return fromRoll;
    return Math.min(fromRoll, shipSpecs.lowBerths);
  }

  function changeHigh(v: number) {
    const clamped = Math.max(0, Math.min(v, maxHighAccepted()));
    setAcceptedPassengers((prev) => ({
      ...prev,
      high: clamped,
      // Re-clamp middle in case staterooms constraint changed
      middle:
        shipSpecs.staterooms > 0
          ? Math.min(prev.middle, Math.max(0, shipSpecs.staterooms - clamped))
          : prev.middle,
    }));
  }
  function changeMiddle(v: number) {
    const clamped = Math.max(0, Math.min(v, maxMiddleAccepted()));
    setAcceptedPassengers((prev) => ({
      ...prev,
      middle: clamped,
      // Re-clamp high in case staterooms constraint changed
      high:
        shipSpecs.staterooms > 0
          ? Math.min(prev.high, Math.max(0, shipSpecs.staterooms - clamped))
          : prev.high,
    }));
  }
  function changeLow(v: number) {
    setAcceptedPassengers((prev) => ({
      ...prev,
      low: Math.max(0, Math.min(v, maxLowAccepted())),
    }));
  }

  function toggleLot(id: string) {
    const lot = allLots.find((l) => l.id === id);
    if (!lot) return;
    setAcceptedLotIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        // Prevent adding if it would exceed cargo space from ship specs
        const currentTons = [...prev]
          .map((lid) => allLots.find((l) => l.id === lid)?.tons ?? 0)
          .reduce((s, t) => s + t, 0);
        if (lotExceedsSpace(lot, currentTons, shipSpecs.cargoSpace)) return prev;
        next.add(id);
      }
      return next;
    });
  }

  const acceptedTons = allLots
    .filter((l) => acceptedLotIds.has(l.id))
    .reduce((sum, l) => sum + l.tons, 0);

  // Keep a ref to the latest callback so the effect only re-runs when
  // acceptedTons changes, not when the parent re-renders.
  const onAcceptedTonsChangeRef = useRef(onAcceptedTonsChange);
  useEffect(() => { onAcceptedTonsChangeRef.current = onAcceptedTonsChange; });
  useEffect(() => {
    onAcceptedTonsChangeRef.current?.(acceptedTons);
  }, [acceptedTons]);

  const availableTons = allLots.reduce((sum, l) => sum + l.tons, 0);

  const totalAcceptedPax =
    acceptedPassengers.high + acceptedPassengers.middle + acceptedPassengers.low;
  const usedStateroomsAfterRoll =
    acceptedPassengers.high + acceptedPassengers.middle;

  const paxRevenue =
    acceptedPassengers.high * PASSENGER_RATES.high +
    acceptedPassengers.middle * PASSENGER_RATES.middle +
    acceptedPassengers.low * PASSENGER_RATES.low;

  const cargoRevenue = acceptedTons * CARGO_RATE;
  const totalRevenue = paxRevenue + cargoRevenue;

  return (
    <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-indigo-700 px-6 py-3 flex items-center gap-2">
        <h2 className="text-lg font-semibold text-white">
          🎲 Roll Available Passengers &amp; Cargo
        </h2>
        <InfoTip text="Roll to see what passengers and cargo are available at the origin world for this jump. Results are auto-allocated to your ship capacity from Ship Specs above." />
      </div>

      <div className="p-6 space-y-6">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Enter the origin and destination world specs, then click Roll.
          Passengers will be automatically allocated to staterooms and low
          berths, and cargo shipments auto-selected to best fill cargo space
          (both from Ship Specs above). Adjust any selections manually if
          needed.
        </p>

        {/* World input form */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <WorldUWPCard
            title="🌍 Origin World"
            uwp={originUWP}
            onUWPChange={onOriginUWPChange}
          />
          <WorldUWPCard
            title="🌏 Destination World"
            uwp={destUWP}
            onUWPChange={onDestUWPChange}
            zone={destZone}
            onZoneChange={onDestZoneChange}
          />
        </div>

        {/* Randomize + Roll buttons */}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleRandomize}
            className="px-5 py-3 rounded-lg border border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-semibold text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            🎲 Randomize Worlds
          </button>
          <button
            type="button"
            onClick={handleRoll}
            disabled={!canRoll}
            className="px-8 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-base transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            🎲 Roll Passengers &amp; Cargo
          </button>
        </div>

        {/* Results */}
        {result && (
          <div className="space-y-5">
            {/* DM summary */}
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 flex items-center">
                Applied Modifiers (DMs)
                <InfoTip text="DMs (Dice Modifiers) are bonuses or penalties added to the dice rolls. Positive values mean more passengers/cargo are available; negative values mean fewer. All DMs are summed before being applied." />
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                {[
                  { label: "Tech DM", value: result.dms.techDM, hint: `TL ${originTL} − TL ${destTL}` },
                  { label: "Dest Pop DM (pax)", value: result.dms.destPopPassengerDM, hint: `Pop ${destPop}` },
                  { label: "Dest Pop DM (cargo)", value: result.dms.destPopCargoDM, hint: `Pop ${destPop}` },
                  { label: "Zone DM (pax)", value: result.dms.zonePassengerDM, hint: destZone },
                  { label: "Total Pax DM", value: result.dms.passengerDM, hint: "combined" },
                  { label: "Total Cargo DM", value: result.dms.cargoDM, hint: "combined" },
                ].map(({ label, value, hint }) => (
                  <div
                    key={label}
                    className="flex items-center justify-between rounded bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-1.5"
                  >
                    <span className="text-gray-600 dark:text-gray-400">
                      {label}
                      <span className="ml-1 text-gray-400 dark:text-gray-500">({hint})</span>
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
                    <li key={c} className="text-xs font-medium text-red-600 dark:text-red-400 flex items-center gap-1">
                      ⚠ {c}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* ── Dice breakdown toggle (right after DMs) ──────────────── */}
            <button
              type="button"
              onClick={() => setShowDetail((v) => !v)}
              className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline focus:outline-none"
            >
              {showDetail ? "▲ Hide dice breakdown" : "▼ Show dice breakdown"}
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
                        <th className="pb-1 text-left text-gray-500 dark:text-gray-400">Class</th>
                        <th className="pb-1 text-left text-gray-500 dark:text-gray-400">Expr</th>
                        <th className="pb-1 text-left text-gray-500 dark:text-gray-400">Dice</th>
                        <th className="pb-1 text-right text-gray-500 dark:text-gray-400">Base</th>
                        <th className="pb-1 text-right text-gray-500 dark:text-gray-400">DM</th>
                        <th className="pb-1 text-right text-gray-500 dark:text-gray-400">Final</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      <PassengerBreakdownRow label="High" result={result.passengers.high} />
                      <PassengerBreakdownRow label="Middle" result={result.passengers.middle} />
                      <PassengerBreakdownRow label="Low" result={result.passengers.low} />
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
                        <th className="pb-1 text-left text-gray-500 dark:text-gray-400">Type</th>
                        <th className="pb-1 text-left text-gray-500 dark:text-gray-400">Expr</th>
                        <th className="pb-1 text-left text-gray-500 dark:text-gray-400">Dice</th>
                        <th className="pb-1 text-right text-gray-500 dark:text-gray-400">Base</th>
                        <th className="pb-1 text-right text-gray-500 dark:text-gray-400">DM</th>
                        <th className="pb-1 text-right text-gray-500 dark:text-gray-400">Count</th>
                        <th className="pb-1 text-right text-gray-500 dark:text-gray-400">Tons</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      <CargoBreakdownRow label="Major" result={result.cargo.major} />
                      <CargoBreakdownRow label="Minor" result={result.cargo.minor} />
                      <CargoBreakdownRow label="Incidental" result={result.cargo.incidental} />
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── Passenger Revenue ───────────────────────────────────── */}
            <div className="rounded-lg border border-amber-200 dark:border-amber-800 overflow-hidden">
              <div className="bg-amber-50 dark:bg-amber-950 px-4 py-3 flex items-center gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400 flex items-center">
                  🧳 Passenger Revenue
                  <InfoTip text="Passengers auto-allocated for best revenue: High (Cr10,000) fills staterooms first, then Middle (Cr8,000) takes remaining staterooms, Low (Cr1,000) fills low berths. Adjust counts manually if needed. Capacity from Ship Specs above." />
                </h3>
              </div>
              <div className="p-4 space-y-3">
                {/* Passenger rows */}
                {(
                  [
                    {
                      label: "High",
                      available: result.passengers.high.finalCount,
                      accepted: acceptedPassengers.high,
                      onChange: changeHigh,
                      maxAccepted: maxHighAccepted(),
                      rate: PASSENGER_RATES.high,
                    },
                    {
                      label: "Middle",
                      available: result.passengers.middle.finalCount,
                      accepted: acceptedPassengers.middle,
                      onChange: changeMiddle,
                      maxAccepted: maxMiddleAccepted(),
                      rate: PASSENGER_RATES.middle,
                    },
                    {
                      label: "Low",
                      available: result.passengers.low.finalCount,
                      accepted: acceptedPassengers.low,
                      onChange: changeLow,
                      maxAccepted: maxLowAccepted(),
                      rate: PASSENGER_RATES.low,
                    },
                  ] as const
                ).map(({ label, available, accepted, onChange, maxAccepted, rate }) => (
                  <div key={label} className="flex items-center gap-3 text-sm">
                    <span className="w-14 font-medium text-gray-700 dark:text-gray-300">
                      {label}
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={maxAccepted}
                      step={1}
                      placeholder="0"
                      value={accepted === 0 ? "" : accepted}
                      onChange={(e) =>
                        onChange(Math.max(0, parseInt(e.target.value, 10) || 0))
                      }
                      className="w-16 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <span className="text-xs text-gray-400 dark:text-gray-500 flex-1">
                      / {available} available
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500 hidden sm:inline">
                      ×{formatCredits(rate)}
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100 text-right w-24">
                      {formatCredits(accepted * rate)}
                    </span>
                  </div>
                ))}

                {/* Totals + capacity */}
                <div className="border-t border-amber-200 dark:border-amber-800 pt-3 space-y-1">
                  <div className="flex justify-between text-sm font-bold text-amber-700 dark:text-amber-400">
                    <span>Total ({totalAcceptedPax} pax accepted)</span>
                    <span>{formatCredits(paxRevenue)}</span>
                  </div>
                  {shipSpecs.staterooms > 0 && (
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      Staterooms: {usedStateroomsAfterRoll} / {shipSpecs.staterooms} used
                    </p>
                  )}
                  {shipSpecs.lowBerths > 0 && (
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      Low berths: {acceptedPassengers.low} / {shipSpecs.lowBerths} used
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* ── Cargo Revenue ────────────────────────────────────────── */}
            <div className="rounded-lg border border-amber-200 dark:border-amber-800 overflow-hidden">
              {/* Cargo summary header */}
              <div className="bg-amber-50 dark:bg-amber-950 px-4 py-3 space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400 flex items-center">
                  📦 Cargo Revenue
                  <InfoTip text="Each shipment is a discrete lot rolled per Book 2 rules: roll for number of lots, then one die per lot for size (Major ×10, Minor ×5, Incidental ×1 tons). Lots cannot be subdivided. Cargo space from Ship Specs above." />
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Major", cargo: result.cargo.major, mult: CARGO_MULTIPLIERS.Major },
                    { label: "Minor", cargo: result.cargo.minor, mult: CARGO_MULTIPLIERS.Minor },
                    { label: "Incidental", cargo: result.cargo.incidental, mult: CARGO_MULTIPLIERS.Incidental },
                  ].map(({ label, cargo, mult }) => (
                    <div key={label} className="flex flex-col gap-0.5 text-sm">
                      <span className="font-semibold text-amber-700 dark:text-amber-400">{label}</span>
                      <span className="text-gray-900 dark:text-gray-100">
                        {cargo.finalCount} lot{cargo.finalCount !== 1 ? "s" : ""}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {cargo.totalTons} t (×{mult}/die)
                      </span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-amber-200 dark:border-amber-800 pt-2 flex justify-between text-sm font-bold text-amber-700 dark:text-amber-400">
                  <span>
                    Available ({availableTons} t · {allLots.length} shipment{allLots.length !== 1 ? "s" : ""})
                  </span>
                  <span>
                    {acceptedLotIds.size} accepted · {acceptedTons} t
                    {shipSpecs.cargoSpace > 0 && (
                      <span className="ml-1 text-xs font-normal text-gray-500 dark:text-gray-400">
                        / {shipSpecs.cargoSpace} t
                      </span>
                    )}
                  </span>
                </div>
              </div>

              {/* Shipments list */}
              <div className="border-t border-amber-200 dark:border-amber-800">
                {allLots.length > 0 ? (
                  <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {allLots.map((lot, i) => {
                      const accepted = acceptedLotIds.has(lot.id);
                      const wouldExceed =
                        !accepted &&
                        lotExceedsSpace(lot, acceptedTons, shipSpecs.cargoSpace);
                      const typeBadge: Record<CargoLot["type"], string> = {
                        Major: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
                        Minor: "bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300",
                        Incidental: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
                      };
                      return (
                        <label
                          key={lot.id}
                          title={
                            wouldExceed
                              ? `Adding this shipment would exceed your ${shipSpecs.cargoSpace} t cargo space`
                              : undefined
                          }
                          className={`flex items-center justify-between px-4 py-2 text-sm transition-colors ${
                            wouldExceed
                              ? "opacity-40 cursor-not-allowed bg-gray-50 dark:bg-gray-800"
                              : accepted
                                ? "bg-white dark:bg-gray-900 cursor-pointer hover:bg-amber-50 dark:hover:bg-amber-950"
                                : "bg-gray-50 dark:bg-gray-800 opacity-50 cursor-pointer hover:bg-amber-50 dark:hover:bg-amber-950"
                          }`}
                        >
                          <span className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={accepted}
                              disabled={wouldExceed}
                              onChange={() => !wouldExceed && toggleLot(lot.id)}
                              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:cursor-not-allowed"
                            />
                            <span className="text-gray-500 dark:text-gray-400 tabular-nums w-6 text-right">
                              #{i + 1}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${typeBadge[lot.type]}`}>
                              {lot.type}
                            </span>
                          </span>
                          <span className="flex items-center gap-4">
                            <span className="text-gray-400 dark:text-gray-500 text-xs">
                              die {lot.sizeDie} × {CARGO_MULTIPLIERS[lot.type]}
                            </span>
                            <span className="font-semibold text-gray-900 dark:text-gray-100 w-16 text-right">
                              {lot.tons} t
                            </span>
                            <span className="text-gray-500 dark:text-gray-400 text-xs w-20 text-right">
                              {formatCredits(lot.tons * CARGO_RATE)}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <p className="px-4 py-3 text-xs text-gray-400 dark:text-gray-500 italic">
                    No cargo available for this route.
                  </p>
                )}

                {/* Cargo revenue total */}
                <div className="bg-amber-50 dark:bg-amber-950 border-t border-amber-200 dark:border-amber-800 px-4 py-3 flex justify-between text-sm font-bold text-amber-700 dark:text-amber-400">
                  <span>Total Cargo Revenue ({acceptedTons} t accepted)</span>
                  <span>{formatCredits(cargoRevenue)}</span>
                </div>
              </div>
            </div>

            {/* ── Total Revenue card ───────────────────────────────────── */}
            <div className="rounded-lg border-2 border-indigo-400 dark:border-indigo-600 bg-indigo-50 dark:bg-indigo-950 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-400 mb-3 flex items-center">
                💰 Total Potential Revenue
                <InfoTip text="Combined revenue from accepted passengers and cargo shipments. Adjust passenger counts or uncheck cargo lots to see the impact." />
              </h3>
              <div className="space-y-1 mb-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Passengers ({totalAcceptedPax} pax)</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{formatCredits(paxRevenue)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Cargo ({acceptedTons} t)</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{formatCredits(cargoRevenue)}</span>
                </div>
              </div>
              <div className="border-t border-indigo-200 dark:border-indigo-800 pt-2 flex justify-between font-bold text-indigo-700 dark:text-indigo-300">
                <span>Total</span>
                <span className="text-xl">{formatCredits(totalRevenue)}</span>
              </div>
            </div>

          </div>
        )}
      </div>
    </section>
  );
}
