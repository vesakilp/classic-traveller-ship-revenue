// Dice utilities for Classic Traveller
// Includes a simple seeded PRNG (LCG) for reproducible rolls.

export type Rng = () => number;

/**
 * Create a seeded pseudo-random number generator using a linear congruential
 * generator (LCG). Passing the same seed always yields the same sequence.
 */
export function createSeededRng(seed: number): Rng {
  let s = seed >>> 0;
  return function (): number {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/** Hash a string seed into a 32-bit integer. */
export function hashSeed(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** Roll a single d6 using the given RNG (or Math.random if none provided). */
export function d6(rng?: Rng): number {
  const r = rng ? rng() : Math.random();
  return Math.floor(r * 6) + 1;
}

/** Roll `count` d6 dice and return the individual results. */
export function rollDice(count: number, rng?: Rng): number[] {
  return Array.from({ length: count }, () => d6(rng));
}

/** Sum an array of dice results. */
export function sumDice(dice: number[]): number {
  return dice.reduce((a, b) => a + b, 0);
}
