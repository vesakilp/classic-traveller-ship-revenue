"use client";

import { useState, useEffect } from "react";

// Classic Traveller passenger and cargo rates (Credits per jump)
const RATES = {
  highPassage: 10_000,
  middlePassage: 8_000,
  lowPassage: 1_000,
  standardCargo: 1_000, // per ton
  mail: 25_000, // per ton (Cr25 per kg)
} as const;

interface ShipSpecs {
  cargoSpace: number;
  highBerths: number;
  middleBerths: number;
  lowBerths: number;
}

interface PassengerInputs {
  highPassengers: number;
  middlePassengers: number;
  lowPassengers: number;
}

interface CargoInputs {
  standardCargoTons: number;
  mailTons: number;
}

const DEFAULT_SHIP_SPECS: ShipSpecs = {
  cargoSpace: 0,
  highBerths: 0,
  middleBerths: 0,
  lowBerths: 0,
};

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
  shipSpecs: "traveller-ship-specs",
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

function InputField({
  label,
  value,
  onChange,
  hint,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint: string;
  max?: number;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
        <span className="ml-2 text-xs text-gray-400 dark:text-gray-500 font-normal">
          ({hint})
        </span>
      </label>
      <input
        type="number"
        min={0}
        max={max}
        value={value}
        onChange={(e) => {
          const val = Math.max(0, Number(e.target.value));
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

export default function RevenueCalculator() {
  // initialized tracks whether localStorage has been read; persist/clamp
  // effects are skipped until true to avoid overwriting stored data with
  // default values on the first render.
  const [initialized, setInitialized] = useState(false);

  const [shipSpecs, setShipSpecs] = useState<ShipSpecs>(DEFAULT_SHIP_SPECS);

  const [passengers, setPassengers] = useState<PassengerInputs>(
    DEFAULT_PASSENGERS,
  );

  const [cargo, setCargo] = useState<CargoInputs>(DEFAULT_CARGO);

  // Load all state from localStorage on mount
  useEffect(() => {
    setShipSpecs(loadFromStorage(STORAGE_KEYS.shipSpecs, DEFAULT_SHIP_SPECS));
    setPassengers(
      loadFromStorage(STORAGE_KEYS.passengers, DEFAULT_PASSENGERS),
    );
    setCargo(loadFromStorage(STORAGE_KEYS.cargo, DEFAULT_CARGO));
    setInitialized(true);
  }, []);

  // Persist ship specs to localStorage (skip before initial load completes)
  useEffect(() => {
    if (!initialized) return;
    localStorage.setItem(STORAGE_KEYS.shipSpecs, JSON.stringify(shipSpecs));
  }, [shipSpecs, initialized]);

  // Persist passengers to localStorage (skip before initial load completes)
  useEffect(() => {
    if (!initialized) return;
    localStorage.setItem(STORAGE_KEYS.passengers, JSON.stringify(passengers));
  }, [passengers, initialized]);

  // Persist cargo to localStorage (skip before initial load completes)
  useEffect(() => {
    if (!initialized) return;
    localStorage.setItem(STORAGE_KEYS.cargo, JSON.stringify(cargo));
  }, [cargo, initialized]);

  // Clamp passengers and cargo when ship specs are reduced (skip on initial mount)
  useEffect(() => {
    if (!initialized) return;
    setPassengers((p) => ({
      highPassengers: Math.min(p.highPassengers, shipSpecs.highBerths),
      middlePassengers: Math.min(p.middlePassengers, shipSpecs.middleBerths),
      lowPassengers: Math.min(p.lowPassengers, shipSpecs.lowBerths),
    }));
    setCargo((c) => ({
      standardCargoTons: Math.min(c.standardCargoTons, shipSpecs.cargoSpace),
      mailTons: c.mailTons,
    }));
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

  const totalPassengerRevenue =
    passengerRevenue.high + passengerRevenue.middle + passengerRevenue.low;
  const totalCargoRevenue = cargoRevenue.standard + cargoRevenue.mail;
  const grandTotal = totalPassengerRevenue + totalCargoRevenue;

  return (
    <div className="space-y-8">
      {/* Ship Specifications Section */}
      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
        <div className="bg-gray-700 px-6 py-3">
          <h2 className="text-lg font-semibold text-white">
            🚢 Ship Specifications
          </h2>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Configure your ship&apos;s capacity. These values set the maximums
            for passenger and cargo selection below and are saved automatically.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <InputField
              label="Cargo Space"
              value={shipSpecs.cargoSpace}
              onChange={(v) =>
                setShipSpecs((s) => ({ ...s, cargoSpace: v }))
              }
              hint="tons"
            />
            <InputField
              label="High Berths"
              value={shipSpecs.highBerths}
              onChange={(v) =>
                setShipSpecs((s) => ({ ...s, highBerths: v }))
              }
              hint="staterooms"
            />
            <InputField
              label="Middle Berths"
              value={shipSpecs.middleBerths}
              onChange={(v) =>
                setShipSpecs((s) => ({ ...s, middleBerths: v }))
              }
              hint="staterooms"
            />
            <InputField
              label="Low Berths"
              value={shipSpecs.lowBerths}
              onChange={(v) =>
                setShipSpecs((s) => ({ ...s, lowBerths: v }))
              }
              hint="capsules"
            />
          </div>
        </div>
      </section>

      {/* Passenger Section */}
      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
        <div className="bg-amber-600 px-6 py-3">
          <h2 className="text-lg font-semibold text-white">
            🚀 Passenger Revenue
          </h2>
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
              max={shipSpecs.highBerths}
            />
            <InputField
              label="Middle Passage"
              value={passengers.middlePassengers}
              onChange={(v) =>
                setPassengers((p) => ({ ...p, middlePassengers: v }))
              }
              hint={formatCredits(RATES.middlePassage) + "/jump"}
              max={shipSpecs.middleBerths}
            />
            <InputField
              label="Low Passage"
              value={passengers.lowPassengers}
              onChange={(v) =>
                setPassengers((p) => ({ ...p, lowPassengers: v }))
              }
              hint={formatCredits(RATES.lowPassage) + "/jump"}
              max={shipSpecs.lowBerths}
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
        <div className="bg-amber-700 px-6 py-3">
          <h2 className="text-lg font-semibold text-white">📦 Cargo Revenue</h2>
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
              max={shipSpecs.cargoSpace}
            />
            <InputField
              label="Mail Cargo"
              value={cargo.mailTons}
              onChange={(v) => setCargo((c) => ({ ...c, mailTons: v }))}
              hint={formatCredits(RATES.mail) + "/ton"}
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
