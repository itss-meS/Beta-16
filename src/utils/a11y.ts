export function announce(message: string): void {
  if (typeof document === 'undefined') return;
  const region = document.getElementById('live-region');
  if (!region) return;
  region.textContent = '';
  window.setTimeout(() => {
    region.textContent = message;
  }, 30);
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function spokenMoney(formatted: string): string {
  return formatted.replace('₹', ' rupees ').replace('-', 'minus ').replace(/\s+/g, ' ').trim();
}
