// UWP (Universal World Profile) utilities for Classic Traveller

export interface WorldUWP {
  starport: string;      // A, B, C, D, E, X
  size: string;          // 0–9, A (hex, 0–10)
  atmosphere: string;    // 0–9, A–F (hex, 0–15)
  hydrographics: string; // 0–9, A (hex, 0–10)
  population: string;    // 0–9, A (hex, 0–10)
  government: string;    // 0–9, A–F (hex, 0–15)
  lawLevel: string;      // 0–9, A–F (hex, 0–15)
  techLevel: string;     // 0–9, A–Z (hex)
}

// Full UWP format: Starport Size Atmo Hydro Pop Gov Law-TL  (9 chars total)
const UWP_RE = /^([A-EX])([0-9A])([0-9A-F])([0-9A])([0-9A])([0-9A-F])([0-9A-F])-([0-9A-Z])$/i;

/** Parse a UWP string like "A646867-8". Returns null if the string is invalid. */
export function parseUWP(s: string): WorldUWP | null {
  const m = s.trim().toUpperCase().match(UWP_RE);
  if (!m) return null;
  return {
    starport:      m[1],
    size:          m[2],
    atmosphere:    m[3],
    hydrographics: m[4],
    population:    m[5],
    government:    m[6],
    lawLevel:      m[7],
    techLevel:     m[8],
  };
}

/** Format a WorldUWP back to a canonical UWP string. */
export function formatUWP(uwp: WorldUWP): string {
  return `${uwp.starport}${uwp.size}${uwp.atmosphere}${uwp.hydrographics}${uwp.population}${uwp.government}${uwp.lawLevel}-${uwp.techLevel}`;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function hexToNum(c: string): number {
  const u = c.toUpperCase();
  if (u >= "0" && u <= "9") return parseInt(u, 10);
  return u.charCodeAt(0) - 65 + 10; // A→10, B→11, …
}

function numToHex(n: number): string {
  if (n <= 9) return n.toString();
  return String.fromCharCode(65 + n - 10); // 10→A, 11→B, …
}

function clamp(n: number, lo: number, hi: number): number {
  return n < lo ? lo : n > hi ? hi : n;
}

function d6(): number {
  return Math.floor(Math.random() * 6) + 1;
}

function d6x2(): number {
  return d6() + d6();
}

// ─── UWP generation ───────────────────────────────────────────────────────────

/**
 * Generate a random UWP following Classic Traveller Book 3 world generation.
 */
export function randomUWP(): WorldUWP {
  // Starport (2d6)
  const spRoll = d6x2();
  const starport =
    spRoll <= 2  ? "X" :
    spRoll <= 4  ? "E" :
    spRoll <= 6  ? "D" :
    spRoll === 7 ? "C" :
    spRoll <= 9  ? "B" : "A";

  // Size: 2d6−2, clamped 0–10
  const sizeNum = clamp(d6x2() - 2, 0, 10);
  const size = numToHex(sizeNum);

  // Atmosphere: 2d6−7+size, clamped 0–15
  const atmoNum = clamp(d6x2() - 7 + sizeNum, 0, 15);
  const atmosphere = numToHex(atmoNum);

  // Hydrographics: 2d6−7+atmo, clamped 0–10
  const hydroNum = clamp(d6x2() - 7 + atmoNum, 0, 10);
  const hydrographics = numToHex(hydroNum);

  // Population: 2d6−2, clamped 0–10
  const popNum = clamp(d6x2() - 2, 0, 10);
  const population = numToHex(popNum);

  // Government: 2d6−7+pop, clamped 0–15
  const govNum = clamp(d6x2() - 7 + popNum, 0, 15);
  const government = numToHex(govNum);

  // Law Level: 2d6−7+gov, clamped 0–15
  const lawNum = clamp(d6x2() - 7 + govNum, 0, 15);
  const lawLevel = numToHex(lawNum);

  // Tech Level: 1d6 + DMs from other characteristics
  const spTLDM: Record<string, number> = { A: 6, B: 4, C: 2, D: 0, E: 0, X: -4 };
  const sizeTLDM = sizeNum <= 1 ? 2 : sizeNum <= 4 ? 1 : 0;
  const atmoTLDM = atmoNum <= 3 || atmoNum >= 10 ? 1 : 0;
  const hydroTLDM = hydroNum === 10 ? 2 : 0;
  const popTLDM  = popNum === 0 ? 0 : popNum <= 5 ? 1 : popNum <= 9 ? 2 : 4;
  const govTLDM  = govNum === 0 || govNum === 5 ? 1 : govNum >= 13 ? -2 : 0;
  const tlNum = clamp(
    d6() + (spTLDM[starport] ?? 0) + sizeTLDM + atmoTLDM + hydroTLDM + popTLDM + govTLDM,
    0, 25,
  );
  const techLevel = numToHex(tlNum);

  return { starport, size, atmosphere, hydrographics, population, government, lawLevel, techLevel };
}

// ─── Accessors for revenue calculations ──────────────────────────────────────

/** Return the population digit string (e.g. "6" or "A") for dice-table lookup. */
export function uwpPopulation(uwp: WorldUWP): string {
  return uwp.population;
}

/** Return tech level as a number for DM calculations. */
export function uwpTechLevel(uwp: WorldUWP): number {
  return hexToNum(uwp.techLevel);
}

// ─── Display descriptions ─────────────────────────────────────────────────────

export function starportDescription(sp: string): string {
  const map: Record<string, string> = {
    A: "Excellent — full services, refined fuel, shipyard",
    B: "Good — full services, refined fuel, limited shipyard",
    C: "Routine — limited facilities, unrefined fuel only",
    D: "Poor — minimal facilities, unrefined fuel only",
    E: "Frontier — no facilities, no fuel available",
    X: "No starport — interdicted or undeveloped",
  };
  return map[sp.toUpperCase()] ?? sp;
}

export function sizeDescription(sz: string): string {
  const n = hexToNum(sz);
  if (n === 0) return "Asteroid belt / ring (no significant gravity)";
  return `~${n * 1600} km diameter`;
}

export function atmosphereDescription(atmo: string): string {
  const descriptions: Record<number, string> = {
    0:  "None (vacuum — vacc suit required)",
    1:  "Trace (vacc suit required)",
    2:  "Very thin, tainted (respirator + filter)",
    3:  "Very thin (respirator required)",
    4:  "Thin, tainted (filter mask required)",
    5:  "Thin (breathable without aid)",
    6:  "Standard",
    7:  "Standard, tainted (filter mask required)",
    8:  "Dense (breathable, slightly thick)",
    9:  "Dense, tainted (filter mask required)",
    10: "Exotic (air supply required)",
    11: "Corrosive (vacc suit required)",
    12: "Insidious (special protection required)",
    13: "Dense, high-pressure",
    14: "Thin, low-pressure",
    15: "Unusual composition",
  };
  return descriptions[hexToNum(atmo)] ?? `Type ${atmo}`;
}

export function hydrographicsDescription(hydro: string): string {
  const n = hexToNum(hydro);
  if (n === 0)  return "Desert world (≤5% water)";
  if (n === 10) return "Water world (96–100% surface water)";
  return `${n * 10 - 5}–${n * 10 + 5}% surface water`;
}

export function populationDescription(pop: string): string {
  const map: Record<string, string> = {
    "0": "Uninhabited",
    "1": "Tens of inhabitants",
    "2": "Hundreds",
    "3": "Thousands",
    "4": "Tens of thousands",
    "5": "Hundreds of thousands",
    "6": "Millions",
    "7": "Tens of millions",
    "8": "Hundreds of millions",
    "9": "Billions",
    "A": "Tens of billions",
  };
  return map[pop.toUpperCase()] ?? `Pop ${pop}`;
}

export function governmentDescription(gov: string): string {
  const descriptions: Record<number, string> = {
    0:  "No government structure",
    1:  "Company / Corporation",
    2:  "Participating democracy",
    3:  "Self-perpetuating oligarchy",
    4:  "Representative democracy",
    5:  "Feudal technocracy",
    6:  "Captive government (colony)",
    7:  "Balkanisation (multiple factions)",
    8:  "Civil service bureaucracy",
    9:  "Impersonal bureaucracy",
    10: "Charismatic dictator",
    11: "Non-charismatic leader",
    12: "Charismatic oligarchy",
    13: "Religious dictatorship",
    14: "Religious autocracy",
    15: "Totalitarian oligarchy",
  };
  return descriptions[hexToNum(gov)] ?? `Government ${gov}`;
}

export function lawLevelDescription(law: string): string {
  const n = hexToNum(law);
  if (n === 0) return "No restrictions — all weapons allowed";
  if (n <= 2)  return "Heavy weapons prohibited";
  if (n <= 4)  return "Automatic weapons prohibited";
  if (n <= 6)  return "Firearms (except shotguns) prohibited";
  if (n <= 8)  return "All firearms prohibited";
  if (n <= 10) return "Bladed weapons prohibited";
  return "Total control — visitors may be detained";
}

export function techLevelDescription(tl: string): string {
  const n = hexToNum(tl);
  if (n <= 1)  return "Primitive — pre-industrial";
  if (n <= 3)  return "Industrial revolution era";
  if (n <= 5)  return "Early 20th century technology";
  if (n <= 7)  return "Contemporary / nuclear era";
  if (n <= 9)  return "Early space age";
  if (n <= 11) return "Interplanetary / early jump drive era";
  if (n <= 13) return "Standard jump drive era";
  if (n <= 15) return "Advanced technology";
  return "Ultra-advanced technology";
}
