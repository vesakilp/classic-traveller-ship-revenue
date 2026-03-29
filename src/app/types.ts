// Shared types used across page and components

export interface ShipSpecs {
  cargoSpace: number;
  staterooms: number; // shared by High and Middle passengers
  lowBerths: number; // for Low passengers (suspended animation)
}

export const DEFAULT_SHIP_SPECS: ShipSpecs = {
  cargoSpace: 0,
  staterooms: 0,
  lowBerths: 0,
};

// v2 key: separate namespace from old highBerths/middleBerths schema
export const SHIP_SPECS_STORAGE_KEY = "traveller-ship-specs-v2";
