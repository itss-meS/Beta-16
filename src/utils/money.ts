export type Cents = number;

export function divRound(n: number, d: number): number {
  if (d === 0) throw new RangeError('division by zero');
  const negative = n < 0 !== d < 0;
  const an = Math.abs(n);
  const ad = Math.abs(d);
  const r = an % ad;
  let q = (an - r) / ad;
  if (r * 2 >= ad) q += 1;
  return negative ? -q : q;
}

export function percentOf(cents: Cents, bps: number): Cents {
  return divRound(cents * bps, 10000);
}

export function sumCents(values: readonly Cents[]): Cents {
  let total = 0;
  for (const v of values) total += v;
  return total;
}

export function rupeesToCents(rupees: number): Cents {
  if (!Number.isInteger(rupees)) throw new RangeError('rupees must be an integer');
  return rupees * 100;
}

function groupIndian(digits: string): string {
  if (digits.length <= 3) return digits;
  const last3 = digits.slice(-3);
  let rest = digits.slice(0, -3);
  const parts: string[] = [];
  while (rest.length > 2) {
    parts.unshift(rest.slice(-2));
    rest = rest.slice(0, -2);
  }
  if (rest.length > 0) parts.unshift(rest);
  return `${parts.join(',')},${last3}`;
}

export type PaiseMode = 'auto' | 'always' | 'never';

export interface FormatOptions {
  paise?: PaiseMode;
  sign?: boolean;
}

export function formatINR(cents: Cents, options: FormatOptions = {}): string {
  const mode = options.paise ?? 'auto';
  const negative = cents < 0;
  const abs = Math.abs(cents);
  let rupees = Math.floor(abs / 100);
  let paise = abs % 100;
  if (mode === 'never') {
    if (paise >= 50) rupees += 1;
    paise = 0;
  }
  const showPaise = mode === 'always' || (mode === 'auto' && paise !== 0);
  const body = groupIndian(String(rupees)) + (showPaise ? `.${String(paise).padStart(2, '0')}` : '');
  const prefix = negative ? '-' : options.sign && cents > 0 ? '+' : '';
  return `${prefix}₹${body}`;
}

export function formatCompactINR(cents: Cents): string {
  const abs = Math.abs(cents);
  const rupees = Math.round(abs / 100);
  const sign = cents < 0 ? '-' : '';
  if (rupees >= 10000000) return `${sign}₹${trimFixed(rupees / 10000000)}Cr`;
  if (rupees >= 100000) return `${sign}₹${trimFixed(rupees / 100000)}L`;
  if (rupees >= 1000) return `${sign}₹${trimFixed(rupees / 1000)}K`;
  return `${sign}₹${rupees}`;
}

function trimFixed(value: number): string {
  const fixed = value.toFixed(1);
  return fixed.endsWith('.0') ? fixed.slice(0, -2) : fixed;
}

export function parseMoneyToCents(input: string): Cents | null {
  let s = input.trim();
  if (s === '') return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  const suffix = /\s*(cr|dr)\.?$/i.exec(s);
  if (suffix) {
    if ((suffix[1] ?? '').toLowerCase() === 'dr') negative = !negative;
    s = s.slice(0, suffix.index);
  }
  s = s.replace(/₹|rs\.?|inr/gi, '').replace(/\s+/g, '');
  if (s.startsWith('-')) {
    negative = !negative;
    s = s.slice(1);
  } else if (s.startsWith('+')) {
    s = s.slice(1);
  }
  s = s.replace(/,/g, '');
  if (!/^\d*\.?\d*$/.test(s) || s === '' || s === '.') return null;
  const [intPart = '0', fracPart = ''] = s.split('.');
  const frac = fracPart.padEnd(3, '0');
  let cents = Number(intPart === '' ? '0' : intPart) * 100 + Number(frac.slice(0, 2));
  if (Number(frac[2]) >= 5) cents += 1;
  if (!Number.isSafeInteger(cents)) return null;
  return negative ? -cents : cents;
}
