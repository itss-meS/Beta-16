import type { Jar, WishlistItem } from '@/types/models';
import { judgeAffordability, type Confidence, type ForecastResult, type Verdict } from './forecast';

export type WishVerdict = Verdict | 'funded';

export interface WishCheck {
  verdict: WishVerdict;
  headline: string;
  neededFromBalanceCents: number;
  fundedByJarCents: number;
  confidence: Confidence;
}

export function checkWish(item: WishlistItem, forecast: ForecastResult, jar: Jar | null): WishCheck {
  const funded = jar ? Math.min(jar.savedCents, item.costCents) : 0;
  const needed = item.costCents - funded;
  if (needed === 0) {
    return {
      verdict: 'funded',
      headline: 'Fully funded by the linked jar.',
      neededFromBalanceCents: 0,
      fundedByJarCents: funded,
      confidence: 'high'
    };
  }
  const judged = judgeAffordability(needed, forecast);
  return {
    verdict: judged.verdict,
    headline: judged.headline,
    neededFromBalanceCents: needed,
    fundedByJarCents: funded,
    confidence: judged.confidence
  };
}

export function rankWishlist(items: readonly WishlistItem[]): WishlistItem[] {
  return items
    .filter((i) => !i.acquired)
    .sort((a, b) => a.priority - b.priority || a.costCents - b.costCents || (a.id < b.id ? -1 : 1));
}
