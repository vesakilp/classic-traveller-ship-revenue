// Classic Traveller trade classification (trade tag) derivation from UWP.
// Source: Classic Traveller Book 2 — Trade and Commerce section.

import { WorldUWP, parseUWP } from "./uwp";

export interface TradeTags {
  Ag: boolean; // Agricultural
  Na: boolean; // Non-Agricultural
  In: boolean; // Industrial
  Ni: boolean; // Non-Industrial
  Ri: boolean; // Rich
  Po: boolean; // Poor
}

function hexVal(c: string): number {
  const u = c.toUpperCase();
  if (u >= "0" && u <= "9") return parseInt(u, 10);
  if (u >= "A" && u <= "Z") return u.charCodeAt(0) - 65 + 10; // A→10, B→11, …
  return 0; // invalid character — treated as 0
}

/**
 * Derive Classic Traveller trade classifications from a UWP.
 * Accepts either a parsed WorldUWP object or a UWP string.
 * Returns all-false tags if the UWP is invalid or incomplete.
 *
 * Rules (Classic Traveller Book 2):
 *   Ag  — Atmosphere 4–9, Hydrographics 4–8, Population 5–7
 *   Na  — Atmosphere 0–3, Hydrographics 0–3, Population ≥6
 *   In  — Atmosphere 0,1,2,4,7 or 9; Population ≥9
 *   Ni  — Population ≤6
 *   Ri  — Atmosphere 6 or 8, Population 6–8, Government 4–9
 *   Po  — Atmosphere 2–5, Hydrographics 0–3
 */
export function deriveTradeTagsFromUWP(uwp: WorldUWP | string): TradeTags {
  const parsed: WorldUWP | null =
    typeof uwp === "string" ? parseUWP(uwp) : uwp;

  if (!parsed) {
    return { Ag: false, Na: false, In: false, Ni: false, Ri: false, Po: false };
  }

  const atmo  = hexVal(parsed.atmosphere);
  const hydro = hexVal(parsed.hydrographics);
  const pop   = hexVal(parsed.population);
  const gov   = hexVal(parsed.government);

  const Ag = atmo >= 4 && atmo <= 9 && hydro >= 4 && hydro <= 8 && pop >= 5 && pop <= 7;
  const Na = atmo <= 3 && hydro <= 3 && pop >= 6;
  const In = [0, 1, 2, 4, 7, 9].includes(atmo) && pop >= 9;
  const Ni = pop <= 6;
  const Ri = (atmo === 6 || atmo === 8) && pop >= 6 && pop <= 8 && gov >= 4 && gov <= 9;
  const Po = atmo >= 2 && atmo <= 5 && hydro <= 3;

  return { Ag, Na, In, Ni, Ri, Po };
}

/** Return the active tag names as an array (e.g. ["Ag", "Ni"]). */
export function tradeTagList(tags: TradeTags): string[] {
  return (Object.keys(tags) as (keyof TradeTags)[]).filter((k) => tags[k]);
}
