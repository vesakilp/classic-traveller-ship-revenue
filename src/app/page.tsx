"use client";

import { useState, useEffect } from "react";
import ShipSpecsPanel from "./components/ShipSpecsPanel";
import PassengerCargoRoller from "./components/PassengerCargoRoller";
import SpeculativeCargoPanel from "./components/SpeculativeCargoPanel";
import {
  ShipSpecs,
  DEFAULT_SHIP_SPECS,
  SHIP_SPECS_STORAGE_KEY,
} from "./types";

export default function Home() {
  const [shipSpecs, setShipSpecs] = useState<ShipSpecs>(DEFAULT_SHIP_SPECS);
  const [initialized, setInitialized] = useState(false);

  // Shared world UWP state — used by both the passenger/cargo roller and
  // the speculative cargo panel so trade tags are derived consistently.
  const [originUWP, setOriginUWP] = useState("A666677-8");
  const [destUWP, setDestUWP]     = useState("B555566-7");
  const [destZone, setDestZone]   = useState<"Green" | "Amber" | "Red">("Green");
  const [acceptedStandardCargoTons, setAcceptedStandardCargoTons] = useState(0);

  // Load ship specs from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SHIP_SPECS_STORAGE_KEY);
      if (stored) setShipSpecs(JSON.parse(stored) as ShipSpecs);
    } catch {
      // ignore parse errors
    }
    setInitialized(true);
  }, []);

  // Persist ship specs whenever they change (skip before first load)
  useEffect(() => {
    if (!initialized) return;
    localStorage.setItem(SHIP_SPECS_STORAGE_KEY, JSON.stringify(shipSpecs));
  }, [shipSpecs, initialized]);

  return (
    <main className="min-h-screen bg-gray-100 dark:bg-gray-950 py-10 px-4">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Header */}
        <header className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            ⭐ Classic Traveller
          </h1>
          <p className="text-lg text-amber-700 dark:text-amber-400 font-medium">
            Ship Revenue Calculator
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Configure your ship, then roll for available passengers and cargo.
          </p>
        </header>

        {/* 1. Ship specs — shared by roller */}
        <ShipSpecsPanel value={shipSpecs} onChange={setShipSpecs} />

        {/* 2. Roll available passengers & cargo */}
        <PassengerCargoRoller
          shipSpecs={shipSpecs}
          originUWP={originUWP}
          onOriginUWPChange={setOriginUWP}
          destUWP={destUWP}
          onDestUWPChange={setDestUWP}
          destZone={destZone}
          onDestZoneChange={setDestZone}
          onAcceptedTonsChange={setAcceptedStandardCargoTons}
        />

        {/* 3. Speculative cargo (Classic Traveller trade & speculation) */}
        <SpeculativeCargoPanel
          shipSpecs={shipSpecs}
          originUWP={originUWP}
          destUWP={destUWP}
          acceptedStandardCargoTons={acceptedStandardCargoTons}
        />
      </div>
    </main>
  );
}
