function pass(input: string, basis: number, prime: number): string {
  let h = basis >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, prime) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export function fnv1a(input: string): string {
  return pass(input, 0x811c9dc5, 0x01000193);
}

export function hash64(input: string): string {
  return pass(input, 0x811c9dc5, 0x01000193) + pass(input, 0x9747b28c, 0x85ebca6b);
}

export function stableId(prefix: string, ...parts: readonly (string | number)[]): string {
  return `${prefix}_${hash64(parts.join('|'))}`;
}
