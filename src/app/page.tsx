"use client";

import { useState, useEffect } from "react";
import ShipSpecsPanel from "./components/ShipSpecsPanel";
import PassengerCargoRoller from "./components/PassengerCargoRoller";
import SpeculativeCargoPanel from "./components/SpeculativeCargoPanel";
import PartyMembersPanel from "./components/PartyMembersPanel";
import {
  ShipSpecs,
  DEFAULT_SHIP_SPECS,
  SHIP_SPECS_STORAGE_KEY,
  Journey,
  DEFAULT_JOURNEY,
  JOURNEY_STORAGE_KEY,
  TravelZone,
} from "./types";

export default function Home() {
  const [shipSpecs, setShipSpecs] = useState<ShipSpecs>(DEFAULT_SHIP_SPECS);
  const [initialized, setInitialized] = useState(false);

  // Journey state — origin/dest UWP and travel zone, stored in localStorage
  const [journey, setJourney] = useState<Journey>(DEFAULT_JOURNEY);

  // acceptedStandardCargoTons is passed from roller → speculative cargo panel
  const [acceptedStandardCargoTons, setAcceptedStandardCargoTons] = useState(0);

  // generateTick: increment to trigger "generate all" across roller + spec cargo
  const [generateTick, setGenerateTick] = useState(0);

  // ── Bootstrap from localStorage ────────────────────────────────────────────
  useEffect(() => {
    try {
      const storedSpecs = localStorage.getItem(SHIP_SPECS_STORAGE_KEY);
      if (storedSpecs) setShipSpecs(JSON.parse(storedSpecs) as ShipSpecs);
    } catch { /* ignore */ }

    try {
      const storedJourney = localStorage.getItem(JOURNEY_STORAGE_KEY);
      if (storedJourney) setJourney(JSON.parse(storedJourney) as Journey);
    } catch { /* ignore */ }

    setInitialized(true);
  }, []);

  // ── Persist to localStorage ────────────────────────────────────────────────
  useEffect(() => {
    if (!initialized) return;
    localStorage.setItem(SHIP_SPECS_STORAGE_KEY, JSON.stringify(shipSpecs));
  }, [shipSpecs, initialized]);

  useEffect(() => {
    if (!initialized) return;
    localStorage.setItem(JOURNEY_STORAGE_KEY, JSON.stringify(journey));
  }, [journey, initialized]);

  // ── Convenience accessors for the first (and only current) stage ───────────
  const stage = journey.stages[0];

  function setOriginUWP(v: string) {
    setJourney((j) => ({
      ...j,
      stages: j.stages.map((s, i) => (i === 0 ? { ...s, originUWP: v } : s)),
    }));
  }
  function setDestUWP(v: string) {
    setJourney((j) => ({
      ...j,
      stages: j.stages.map((s, i) => (i === 0 ? { ...s, destUWP: v } : s)),
    }));
  }
  function setDestZone(v: TravelZone) {
    setJourney((j) => ({
      ...j,
      stages: j.stages.map((s, i) => (i === 0 ? { ...s, destZone: v } : s)),
    }));
  }

  // ── Journey actions ────────────────────────────────────────────────────────

  function handleGenerateJourney() {
    setGenerateTick((t) => t + 1);
  }

  function handleReturnJourney() {
    setJourney((j) => ({
      ...j,
      stages: j.stages.map((s) => ({
        ...s,
        originUWP: s.destUWP,
        destUWP: s.originUWP,
        // Reset zone to Green: the new destination is the original origin, whose
        // zone was not separately tracked. The user can adjust it if needed.
        destZone: "Green" as const,
      })),
    }));
  }

  function handleNewJourney() {
    if (!window.confirm("Are you sure you want to start a new journey? This will wipe the current stage.")) {
      return;
    }
    setJourney(DEFAULT_JOURNEY);
    setAcceptedStandardCargoTons(0);
  }

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
            Configure your ship and party, then generate the journey.
          </p>
        </header>

        {/* 1. Ship specs */}
        <ShipSpecsPanel value={shipSpecs} onChange={setShipSpecs} />

        {/* 2. Party members */}
        <PartyMembersPanel />

        {/* 3. Journey controls */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
          <div className="bg-violet-700 px-6 py-3">
            <h2 className="text-lg font-semibold text-white">🗺️ Journey Controls</h2>
          </div>
          <div className="p-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleGenerateJourney}
              className="px-6 py-3 rounded-lg bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-white font-semibold text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2"
            >
              🎲 Generate Journey
            </button>
            <button
              type="button"
              onClick={handleReturnJourney}
              className="px-6 py-3 rounded-lg bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white font-semibold text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2"
              title="Swap origin and destination to plan the return trip"
            >
              🔄 Return Journey
            </button>
            <button
              type="button"
              onClick={handleNewJourney}
              className="px-6 py-3 rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950 hover:bg-red-100 dark:hover:bg-red-900 text-red-700 dark:text-red-300 font-semibold text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              🗑️ New Journey
            </button>
          </div>
        </div>

        {/* 4. Roll available passengers & cargo */}
        <PassengerCargoRoller
          shipSpecs={shipSpecs}
          originUWP={stage.originUWP}
          onOriginUWPChange={setOriginUWP}
          destUWP={stage.destUWP}
          onDestUWPChange={setDestUWP}
          destZone={stage.destZone}
          onDestZoneChange={setDestZone}
          onAcceptedTonsChange={setAcceptedStandardCargoTons}
          generateTick={generateTick}
        />

        {/* 5. Speculative cargo */}
        <SpeculativeCargoPanel
          shipSpecs={shipSpecs}
          originUWP={stage.originUWP}
          destUWP={stage.destUWP}
          acceptedStandardCargoTons={acceptedStandardCargoTons}
          generateTick={generateTick}
        />
      </div>
    </main>
  );
}
