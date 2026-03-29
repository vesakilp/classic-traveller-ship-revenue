"use client";

import { useState } from "react";

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

function formatCredits(amount: number): string {
  return `Cr${amount.toLocaleString()}`;
}

function InputField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint: string;
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
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value)))}
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
  const [passengers, setPassengers] = useState<PassengerInputs>({
    highPassengers: 0,
    middlePassengers: 0,
    lowPassengers: 0,
  });

  const [cargo, setCargo] = useState<CargoInputs>({
    standardCargoTons: 0,
    mailTons: 0,
  });

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
            />
            <InputField
              label="Middle Passage"
              value={passengers.middlePassengers}
              onChange={(v) =>
                setPassengers((p) => ({ ...p, middlePassengers: v }))
              }
              hint={formatCredits(RATES.middlePassage) + "/jump"}
            />
            <InputField
              label="Low Passage"
              value={passengers.lowPassengers}
              onChange={(v) =>
                setPassengers((p) => ({ ...p, lowPassengers: v }))
              }
              hint={formatCredits(RATES.lowPassage) + "/jump"}
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
