"use client";

import { useState, useEffect, useRef } from "react";
import { ShipSpecs } from "../types";

// Classic Traveller passenger and cargo rates (Credits per jump)
const RATES = {
  highPassage: 10_000,
  middlePassage: 8_000,
  lowPassage: 1_000,
  standardCargo: 1_000, // per ton
  mail: 25_000, // per ton (Cr25 per kg)
} as const;

interface PassengerInputs {
  highPassengers: number;
  middlePassengers: number;
  lowPassengers: number;
}

interface CargoInputs {
  standardCargoTons: number;
  mailTons: number;
}

const DEFAULT_PASSENGERS: PassengerInputs = {
  highPassengers: 0,
  middlePassengers: 0,
  lowPassengers: 0,
};

const DEFAULT_CARGO: CargoInputs = {
  standardCargoTons: 0,
  mailTons: 0,
};

const STORAGE_KEYS = {
  passengers: "traveller-passengers",
  cargo: "traveller-cargo",
};

function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? (JSON.parse(item) as T) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function formatCredits(amount: number): string {
  return `Cr${amount.toLocaleString()}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

let _tipId = 0;

function InfoTip({ text }: { text: string }) {
  const [id] = useState(() => ++_tipId);
  const [open, setOpen] = useState(false);
  const [tipStyle, setTipStyle] = useState<React.CSSProperties>({});
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnScroll = () => setOpen(false);
    const closeOnOther = (e: Event) => {
      if ((e as CustomEvent).detail !== id) setOpen(false);
    };
    window.addEventListener("scroll", closeOnScroll, { capture: true, passive: true });
    window.addEventListener("infotip-open", closeOnOther);
    return () => {
      window.removeEventListener("scroll", closeOnScroll, { capture: true });
      window.removeEventListener("infotip-open", closeOnOther);
    };
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
      window.dispatchEvent(new CustomEvent("infotip-open", { detail: id }));
    }
    setOpen((v) => !v);
  };

  return (
    <span className="relative inline-block align-middle">
      <button
        ref={btnRef}
        type="button"
        onClick={handleToggle}
        className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-amber-100 hover:text-amber-600 dark:hover:bg-amber-900 dark:hover:text-amber-300 text-xs font-bold focus:outline-none transition-colors"
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
            className="w-64 rounded-lg bg-gray-900 text-white text-xs p-3 shadow-xl border border-gray-600"
            role="tooltip"
            onClick={() => setOpen(false)}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute top-0 right-0 w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white"
              aria-label="Close"
            >
              ✕
            </button>
            <p className="pr-8">{text}</p>
          </div>
        </>
      )}
    </span>
  );
}

function InputField({
  label,
  value,
  onChange,
  hint,
  max,
  infoText,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint: string;
  max?: number;
  infoText?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
          {label}
          {infoText && <InfoTip text={infoText} />}
          <span className="ml-2 text-xs text-gray-400 dark:text-gray-500 font-normal">
            ({hint})
          </span>
        </label>
        {max !== undefined && (
          <span
            className="text-xs text-gray-400 dark:text-gray-500"
            aria-label={`used: ${value}, maximum: ${max}`}
          >
            {value} / {max}
          </span>
        )}
      </div>
      <input
        type="number"
        min={0}
        max={max}
        step={1}
        placeholder="0"
        value={value === 0 ? "" : value}
        onChange={(e) => {
          const val = Math.max(0, parseInt(e.target.value, 10) || 0);
          onChange(max !== undefined ? Math.min(val, max) : val);
        }}
        className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
      />
    </div>
  );
}

function RevenueRow({
  label,
  quantity,
  unit,
  rate,
  total,
}: {
  label: string;
  quantity: number;
  unit: string;
  rate: number;
  total: number;
}) {
  return (
    <tr className={total === 0 ? "opacity-40" : ""}>
      <td className="py-2 pr-4 text-sm text-gray-800 dark:text-gray-200 font-medium">
        {label}
      </td>
      <td className="py-2 pr-4 text-sm text-right text-gray-600 dark:text-gray-400">
        {quantity} {unit}
      </td>
      <td className="py-2 pr-4 text-sm text-right text-gray-600 dark:text-gray-400">
        {formatCredits(rate)}
      </td>
      <td className="py-2 text-sm text-right font-semibold text-amber-700 dark:text-amber-400">
        {formatCredits(total)}
      </td>
    </tr>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function RevenueCalculator({
  shipSpecs,
}: {
  shipSpecs: ShipSpecs;
}) {
  // initialized tracks whether localStorage has been read; persist/clamp
  // effects are skipped until true to avoid overwriting stored data with
  // default values on the first render.
  const [initialized, setInitialized] = useState(false);

  const [passengers, setPassengers] = useState<PassengerInputs>(
    DEFAULT_PASSENGERS,
  );

  const [cargo, setCargo] = useState<CargoInputs>(DEFAULT_CARGO);

  // Load passengers and cargo from localStorage on mount
  useEffect(() => {
    setPassengers(
      loadFromStorage(STORAGE_KEYS.passengers, DEFAULT_PASSENGERS),
    );
    setCargo(loadFromStorage(STORAGE_KEYS.cargo, DEFAULT_CARGO));
    setInitialized(true);
  }, []);

  // Persist passengers to localStorage
  useEffect(() => {
    if (!initialized) return;
    localStorage.setItem(STORAGE_KEYS.passengers, JSON.stringify(passengers));
  }, [passengers, initialized]);

  // Persist cargo to localStorage
  useEffect(() => {
    if (!initialized) return;
    localStorage.setItem(STORAGE_KEYS.cargo, JSON.stringify(cargo));
  }, [cargo, initialized]);

  // Clamp passengers and cargo when ship specs change (skip on initial mount)
  useEffect(() => {
    if (!initialized) return;
    setPassengers((p) => {
      // High and Middle share staterooms. High passengers are clamped first so
      // that existing High bookings are preserved when staterooms are reduced;
      // Middle passengers receive whatever capacity remains.
      const clampedHigh = Math.min(p.highPassengers, shipSpecs.staterooms);
      const clampedMiddle = Math.min(
        p.middlePassengers,
        Math.max(0, shipSpecs.staterooms - clampedHigh),
      );
      return {
        highPassengers: clampedHigh,
        middlePassengers: clampedMiddle,
        lowPassengers: Math.min(p.lowPassengers, shipSpecs.lowBerths),
      };
    });
    setCargo((c) => {
      const clampedStandard = Math.min(
        c.standardCargoTons,
        shipSpecs.cargoSpace,
      );
      return {
        standardCargoTons: clampedStandard,
        mailTons: Math.min(c.mailTons, shipSpecs.cargoSpace - clampedStandard),
      };
    });
  }, [shipSpecs, initialized]);

  const passengerRevenue = {
    high: passengers.highPassengers * RATES.highPassage,
    middle: passengers.middlePassengers * RATES.middlePassage,
    low: passengers.lowPassengers * RATES.lowPassage,
  };

  const cargoRevenue = {
    standard: cargo.standardCargoTons * RATES.standardCargo,
    mail: cargo.mailTons * RATES.mail,
  };

  const usedStateroomCount =
    passengers.highPassengers + passengers.middlePassengers;
  const maxHighPassengers = Math.max(
    0,
    shipSpecs.staterooms - passengers.middlePassengers,
  );
  const maxMiddlePassengers = Math.max(
    0,
    shipSpecs.staterooms - passengers.highPassengers,
  );
  const maxStandardCargo = shipSpecs.cargoSpace - cargo.mailTons;
  const maxMailCargo = shipSpecs.cargoSpace - cargo.standardCargoTons;

  const totalPassengerRevenue =
    passengerRevenue.high + passengerRevenue.middle + passengerRevenue.low;
  const totalCargoRevenue = cargoRevenue.standard + cargoRevenue.mail;
  const grandTotal = totalPassengerRevenue + totalCargoRevenue;

  return (
    <div className="space-y-8">
      {/* Passenger Section */}
      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
        <div className="bg-amber-600 px-6 py-3 flex items-center gap-2">
          <h2 className="text-lg font-semibold text-white">
            🧳 Passenger Revenue
          </h2>
          <InfoTip text="High and Middle passengers each occupy one stateroom (configured in Ship Specs above). Low passengers use low berth capsules (suspended animation, Cr1,000/jump)." />
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <InputField
              label="High Passage"
              value={passengers.highPassengers}
              onChange={(v) =>
                setPassengers((p) => ({ ...p, highPassengers: v }))
              }
              hint={formatCredits(RATES.highPassage) + "/jump"}
              max={shipSpecs.staterooms > 0 ? maxHighPassengers : undefined}
              infoText="High Passage: Cr10,000 per jump. Passenger receives a private stateroom and full steward service. Counts against stateroom capacity."
            />
            <InputField
              label="Middle Passage"
              value={passengers.middlePassengers}
              onChange={(v) =>
                setPassengers((p) => ({ ...p, middlePassengers: v }))
              }
              hint={formatCredits(RATES.middlePassage) + "/jump"}
              max={shipSpecs.staterooms > 0 ? maxMiddlePassengers : undefined}
              infoText="Middle Passage: Cr8,000 per jump. Passenger uses a stateroom but without full service. Counts against stateroom capacity (shared with High Passage)."
            />
            <InputField
              label="Low Passage"
              value={passengers.lowPassengers}
              onChange={(v) =>
                setPassengers((p) => ({ ...p, lowPassengers: v }))
              }
              hint={formatCredits(RATES.lowPassage) + "/jump"}
              max={shipSpecs.lowBerths > 0 ? shipSpecs.lowBerths : undefined}
              infoText="Low Passage: Cr1,000 per jump. Passenger travels in suspended animation in a low berth capsule. Small risk of death on revival."
            />
          </div>

          {shipSpecs.staterooms > 0 && (
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Staterooms used: {usedStateroomCount} / {shipSpecs.staterooms}
              {usedStateroomCount > shipSpecs.staterooms && (
                <span className="ml-2 text-red-500 font-medium">
                  ⚠ exceeds capacity
                </span>
              )}
            </p>
          )}

          <div className="mt-4 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="pb-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Type
                  </th>
                  <th className="pb-2 text-right text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Qty
                  </th>
                  <th className="pb-2 text-right text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Rate
                  </th>
                  <th className="pb-2 text-right text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Revenue
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                <RevenueRow
                  label="High Passage"
                  quantity={passengers.highPassengers}
                  unit="pax"
                  rate={RATES.highPassage}
                  total={passengerRevenue.high}
                />
                <RevenueRow
                  label="Middle Passage"
                  quantity={passengers.middlePassengers}
                  unit="pax"
                  rate={RATES.middlePassage}
                  total={passengerRevenue.middle}
                />
                <RevenueRow
                  label="Low Passage"
                  quantity={passengers.lowPassengers}
                  unit="pax"
                  rate={RATES.lowPassage}
                  total={passengerRevenue.low}
                />
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-amber-400 dark:border-amber-600">
                  <td
                    colSpan={3}
                    className="pt-2 text-sm font-semibold text-gray-700 dark:text-gray-300"
                  >
                    Total Passenger Revenue
                  </td>
                  <td className="pt-2 text-right font-bold text-amber-700 dark:text-amber-400">
                    {formatCredits(totalPassengerRevenue)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </section>

      {/* Cargo Section */}
      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
        <div className="bg-amber-700 px-6 py-3 flex items-center gap-2">
          <h2 className="text-lg font-semibold text-white">📦 Cargo Revenue</h2>
          <InfoTip text="Standard Freight at Cr1,000/ton. Mail at Cr25,000/ton (Cr25 per kg). Combined tonnage cannot exceed your ship's cargo space configured in Ship Specs above." />
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField
              label="Standard Freight"
              value={cargo.standardCargoTons}
              onChange={(v) =>
                setCargo((c) => ({ ...c, standardCargoTons: v }))
              }
              hint={formatCredits(RATES.standardCargo) + "/ton"}
              max={shipSpecs.cargoSpace > 0 ? maxStandardCargo : undefined}
              infoText="Basic cargo at Cr1,000 per ton. The maximum is your cargo space minus any tons already allocated to mail."
            />
            <InputField
              label="Mail Cargo"
              value={cargo.mailTons}
              onChange={(v) => setCargo((c) => ({ ...c, mailTons: v }))}
              hint={formatCredits(RATES.mail) + "/ton"}
              max={shipSpecs.cargoSpace > 0 ? maxMailCargo : undefined}
              infoText="Mail at Cr25,000 per ton (Cr25/kg). Highly lucrative but requires a Naval or Scout base at origin or destination. The maximum is your cargo space minus standard freight."
            />
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="pb-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Type
                  </th>
                  <th className="pb-2 text-right text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Qty
                  </th>
                  <th className="pb-2 text-right text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Rate
                  </th>
                  <th className="pb-2 text-right text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Revenue
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                <RevenueRow
                  label="Standard Freight"
                  quantity={cargo.standardCargoTons}
                  unit="tons"
                  rate={RATES.standardCargo}
                  total={cargoRevenue.standard}
                />
                <RevenueRow
                  label="Mail Cargo"
                  quantity={cargo.mailTons}
                  unit="tons"
                  rate={RATES.mail}
                  total={cargoRevenue.mail}
                />
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-amber-400 dark:border-amber-600">
                  <td
                    colSpan={3}
                    className="pt-2 text-sm font-semibold text-gray-700 dark:text-gray-300"
                  >
                    Total Cargo Revenue
                  </td>
                  <td className="pt-2 text-right font-bold text-amber-700 dark:text-amber-400">
                    {formatCredits(totalCargoRevenue)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </section>

      {/* Grand Total */}
      <section className="rounded-xl border-2 border-amber-500 dark:border-amber-600 bg-amber-50 dark:bg-amber-950 shadow-md p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300 uppercase tracking-wide">
              Total Jump Revenue
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
              Passengers + Cargo combined
            </p>
          </div>
          <p className="text-3xl font-bold text-amber-700 dark:text-amber-300">
            {formatCredits(grandTotal)}
          </p>
        </div>
      </section>

      {/* Rate Reference */}
      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-6">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
          Classic Traveller Rate Reference (per jump)
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { name: "High Passage", rate: RATES.highPassage, unit: "/pax" },
            { name: "Middle Passage", rate: RATES.middlePassage, unit: "/pax" },
            { name: "Low Passage", rate: RATES.lowPassage, unit: "/pax" },
            { name: "Standard Cargo", rate: RATES.standardCargo, unit: "/ton" },
            { name: "Mail", rate: RATES.mail, unit: "/ton" },
          ].map(({ name, rate, unit }) => (
            <div
              key={name}
              className="text-center rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3"
            >
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                {name}
              </p>
              <p className="text-sm font-bold text-amber-700 dark:text-amber-400">
                {formatCredits(rate)}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500">{unit}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
