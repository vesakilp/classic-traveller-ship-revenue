"use client";

import { useState } from "react";
import { ShipSpecs } from "../types";

// ─── Shared sub-components ────────────────────────────────────────────────────

function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block align-middle">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-amber-100 hover:text-amber-600 dark:hover:bg-amber-900 dark:hover:text-amber-300 text-xs font-bold focus:outline-none transition-colors"
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

function NumberField({
  label,
  value,
  onChange,
  hint,
  infoText,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint: string;
  infoText?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
        {label}
        {infoText && <InfoTip text={infoText} />}
        <span className="ml-2 text-xs text-gray-400 dark:text-gray-500 font-normal">
          ({hint})
        </span>
      </label>
      <input
        type="number"
        min={0}
        step={1}
        placeholder="0"
        value={value === 0 ? "" : value}
        onChange={(e) =>
          onChange(Math.max(0, parseInt(e.target.value, 10) || 0))
        }
        className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
      />
    </div>
  );
}

// ─── Ship Specs Panel ─────────────────────────────────────────────────────────

export default function ShipSpecsPanel({
  value,
  onChange,
}: {
  value: ShipSpecs;
  onChange: (v: ShipSpecs) => void;
}) {
  return (
    <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
      <div className="bg-gray-700 px-6 py-3">
        <h2 className="text-lg font-semibold text-white">
          🚢 Ship Specifications
        </h2>
      </div>
      <div className="p-6 space-y-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Configure your ship's capacity. These values control
          auto-selection of passengers and cargo after each roll and define
          the limits used by the passenger and cargo tools below.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <NumberField
            label="Cargo Space"
            value={value.cargoSpace}
            onChange={(v) => onChange({ ...value, cargoSpace: v })}
            hint="tons"
            infoText="Total cargo hold in tons. Used to auto-select the best-fitting cargo shipments after rolling. Also limits manual cargo entry."
          />
          <NumberField
            label="Staterooms"
            value={value.staterooms}
            onChange={(v) => onChange({ ...value, staterooms: v })}
            hint="High & Middle"
            infoText="Number of staterooms aboard. Both High Passage (Cr10,000) and Middle Passage (Cr8,000) each occupy one stateroom — combined total cannot exceed this. High passengers fill first for best revenue."
          />
          <NumberField
            label="Low Berths"
            value={value.lowBerths}
            onChange={(v) => onChange({ ...value, lowBerths: v })}
            hint="capsules"
            infoText="Number of low berth capsules for Low passage (Cr1,000/jump). Each Low passenger uses one capsule (suspended animation, small revival risk)."
          />
        </div>
      </div>
    </section>
  );
}
