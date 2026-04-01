"use client";

import { useState, useEffect, useRef } from "react";
import { ShipSpecs } from "../types";

// ─── Shared sub-components ────────────────────────────────────────────────────

let _tipId = 0;

function InfoTip({ text }: { text: string }) {
  const [id] = useState(() => ++_tipId);
  const [open, setOpen] = useState(false);
  const [tipStyle, setTipStyle] = useState<React.CSSProperties>({});
  const btnRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const closeOnOther = (e: Event) => {
      if ((e as CustomEvent).detail !== id) setOpen(false);
    };
    const closeOnOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (!popupRef.current?.contains(target) && !btnRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    window.addEventListener("scroll", close, { capture: true, passive: true });
    window.addEventListener("infotip-open", closeOnOther);
    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("touchstart", closeOnOutside, { passive: true });
    return () => {
      window.removeEventListener("scroll", close, { capture: true });
      window.removeEventListener("infotip-open", closeOnOther);
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("touchstart", closeOnOutside);
    };
  }, [open, id]);

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
        <div
          ref={popupRef}
          style={tipStyle}
          className="w-64 rounded-lg bg-gray-900 text-white text-xs p-3 shadow-xl border border-gray-600"
          role="tooltip"
          onClick={(e) => { e.stopPropagation(); setOpen(false); }}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setOpen(false); }}
            className="absolute top-0 right-0 w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
          <p className="pr-8">{text}</p>
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
          🚀 Ship Specifications
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <NumberField
            label="Ship's Credits"
            value={value.capital}
            onChange={(v) => onChange({ ...value, capital: v })}
            hint="credits"
            infoText="Current operating capital available to the ship. Shared with Speculative Cargo as the purchase budget."
          />
        </div>
      </div>
    </section>
  );
}
