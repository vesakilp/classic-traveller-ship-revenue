// Shared types used across page and components

export interface ShipSpecs {
  cargoSpace: number;
  staterooms: number; // shared by High and Middle passengers
  lowBerths: number; // for Low passengers (suspended animation)
  capital: number; // Ship's Credits — current operating capital
}

export const DEFAULT_SHIP_SPECS: ShipSpecs = {
  cargoSpace: 0,
  staterooms: 0,
  lowBerths: 0,
  capital: 0,
};

// v2 key: separate namespace from old highBerths/middleBerths schema
export const SHIP_SPECS_STORAGE_KEY = "traveller-ship-specs-v2";

// ─── Party Members ────────────────────────────────────────────────────────────

export interface PartyMember {
  id: string;
  name: string;
  brokerLevel: number;
  stewardLevel: number;
  notes: string;
}

export const DEFAULT_PARTY_MEMBER: Omit<PartyMember, "id"> = {
  name: "",
  brokerLevel: 0,
  stewardLevel: 0,
  notes: "",
};

export const PARTY_MEMBERS_STORAGE_KEY = "traveller-party-members-v1";

// ─── Journey Stages ───────────────────────────────────────────────────────────

export type TravelZone = "Green" | "Amber" | "Red";

export interface JourneyStage {
  id: string;
  originUWP: string;
  destUWP: string;
  destZone: TravelZone;
}

export interface Journey {
  stages: JourneyStage[];
}

export const DEFAULT_JOURNEY: Journey = {
  stages: [
    { id: "stage-1", originUWP: "A666677-8", destUWP: "B555566-7", destZone: "Green" },
  ],
};

export const JOURNEY_STORAGE_KEY = "traveller-journey-v1";
