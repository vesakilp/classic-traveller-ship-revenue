"use client";

import { useState, useEffect } from "react";
import ShipSpecsPanel from "./components/ShipSpecsPanel";
import PassengerCargoRoller from "./components/PassengerCargoRoller";
import RevenueCalculator from "./components/RevenueCalculator";
import {
  ShipSpecs,
  DEFAULT_SHIP_SPECS,
  SHIP_SPECS_STORAGE_KEY,
} from "./types";

export default function Home() {
  const [shipSpecs, setShipSpecs] = useState<ShipSpecs>(DEFAULT_SHIP_SPECS);
  const [initialized, setInitialized] = useState(false);

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
            Configure your ship, roll for available passengers and cargo, then
            track actual revenue.
          </p>
        </header>

        {/* 1. Ship specs — shared by roller and manual calculator */}
        <ShipSpecsPanel value={shipSpecs} onChange={setShipSpecs} />

        {/* 2. Roll available passengers & cargo (uses ship specs for auto-selection) */}
        <PassengerCargoRoller shipSpecs={shipSpecs} />

        {/* 3. Manual revenue calculator (uses ship specs for capacity limits) */}
        <RevenueCalculator shipSpecs={shipSpecs} />
      </div>
    </main>
  );
}
