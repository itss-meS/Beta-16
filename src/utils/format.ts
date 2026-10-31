const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

export function shortDate(iso: string): string {
  const month = Number(iso.slice(5, 7));
  const day = Number(iso.slice(8, 10));
  return `${day} ${MONTHS[month - 1] ?? ''}`;
}

export function monthLabel(key: string): string {
  const month = Number(key.slice(5, 7));
  return MONTHS[month - 1] ?? key;
}

export function longDate(iso: string): string {
  return `${shortDate(iso)} ${iso.slice(0, 4)}`;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
