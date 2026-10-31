export interface Prng {
  nextU32(): number;
  nextInt(bound: number): number;
}

export function createPrng(seed: number): Prng {
  let a = seed >>> 0;
  const nextU32 = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
  return {
    nextU32,
    nextInt(bound: number): number {
      if (!Number.isInteger(bound) || bound <= 0 || bound > 1048576) {
        throw new RangeError('bound must be an integer in [1, 1048576]');
      }
      return Math.floor((nextU32() * bound) / 4294967296);
    }
  };
}
