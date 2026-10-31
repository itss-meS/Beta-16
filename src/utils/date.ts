export type ISODate = string;
export type Clock = () => ISODate;

const MS_PER_DAY = 86400000;
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12
};

export function systemClock(): ISODate {
  const now = new Date();
  const y = String(now.getFullYear()).padStart(4, '0');
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function fixedClock(date: ISODate): Clock {
  return () => date;
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function isValidISO(value: string): boolean {
  const match = ISO_RE.exec(value);
  if (!match) return false;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

export function toEpochDay(iso: ISODate): number {
  const match = ISO_RE.exec(iso);
  if (!match) throw new RangeError(`invalid date: ${iso}`);
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / MS_PER_DAY;
}

export function fromEpochDay(epochDay: number): ISODate {
  const d = new Date(epochDay * MS_PER_DAY);
  const y = String(d.getUTCFullYear()).padStart(4, '0');
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(iso: ISODate, days: number): ISODate {
  return fromEpochDay(toEpochDay(iso) + days);
}

export function diffDays(later: ISODate, earlier: ISODate): number {
  return toEpochDay(later) - toEpochDay(earlier);
}

export function addMonths(iso: ISODate, months: number): ISODate {
  const match = ISO_RE.exec(iso);
  if (!match) throw new RangeError(`invalid date: ${iso}`);
  const y = Number(match[1]);
  const m = Number(match[2]) - 1;
  const d = Number(match[3]);
  const total = y * 12 + m + months;
  const ny = Math.floor(total / 12);
  const nm = total - ny * 12 + 1;
  const nd = Math.min(d, daysInMonth(ny, nm));
  return `${String(ny).padStart(4, '0')}-${String(nm).padStart(2, '0')}-${String(nd).padStart(2, '0')}`;
}

export function monthKey(iso: ISODate): string {
  return iso.slice(0, 7);
}

export function startOfMonth(iso: ISODate): ISODate {
  return `${iso.slice(0, 7)}-01`;
}

export function endOfMonth(iso: ISODate): ISODate {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  return `${iso.slice(0, 7)}-${String(daysInMonth(y, m)).padStart(2, '0')}`;
}

export function dayOfWeek(iso: ISODate): number {
  return (((toEpochDay(iso) + 4) % 7) + 7) % 7;
}

export function compareISO(a: ISODate, b: ISODate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function expandYear(raw: string): number {
  const n = Number(raw);
  return raw.length <= 2 ? 2000 + n : n;
}

function build(y: number, m: number, d: number): ISODate | null {
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null;
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function parseFlexibleDate(input: string): ISODate | null {
  const s = input.trim();
  let match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s);
  if (match) return build(Number(match[1]), Number(match[2]), Number(match[3]));
  match = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})(?!\d)/.exec(s);
  if (match) return build(expandYear(match[3] ?? ''), Number(match[2]), Number(match[1]));
  match = /^(\d{1,2})[\s\-/.]+([A-Za-z]{3,9})[\s\-/.,]+(\d{4}|\d{2})(?!\d)/.exec(s);
  if (match) {
    const month = MONTHS[(match[2] ?? '').toLowerCase().slice(0, 3)];
    if (!month) return null;
    return build(expandYear(match[3] ?? ''), month, Number(match[1]));
  }
  return null;
}
