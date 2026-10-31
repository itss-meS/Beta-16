import { CATEGORIES, type Category, type CategorizationEntry, type Transaction } from '@/types/models';

export const EMBEDDING_DIM = 384;
export const EMBEDDING_METRIC = 'cosine';
export const KNN_K = 3;
export const MIN_SIMILARITY = 0.55;
export const PROPAGATION_SIMILARITY = 0.9;

const NOISE = new Set([
  'UPI', 'POS', 'NEFT', 'IMPS', 'RTGS', 'ACH', 'ECS', 'NACH', 'DR', 'CR', 'TXN', 'REF', 'PAYMENT', 'PAID', 'TO',
  'FROM', 'BY', 'TRANSFER', 'PURCHASE', 'DEBIT', 'CREDIT', 'CARD', 'ATM', 'WDL', 'VPA', 'PYMT', 'ONLINE', 'MOB',
  'MOBILE', 'INB', 'BIL', 'BILLPAY', 'IN', 'AT', 'ON', 'FOR', 'THE', 'AND'
]);

function titleCase(word: string): string {
  return word.charAt(0) + word.slice(1).toLowerCase();
}

function vpaMerchant(upper: string): string | null {
  const match = /([A-Z0-9._-]{3,})@[A-Z0-9.-]+/.exec(upper);
  if (!match) return null;
  const part = (match[1] ?? '').split(/[._-]/).find((p) => /^[A-Z]{3,}$/.test(p));
  if (!part || NOISE.has(part)) return null;
  return titleCase(part);
}

export function normalizeMerchant(description: string): string {
  const upper = description.toUpperCase();
  const vpa = vpaMerchant(upper);
  if (vpa) return vpa;
  const tokens = upper.replace(/[A-Z0-9._-]+@[A-Z0-9.-]+/g, ' ').split(/[^A-Z0-9&]+/).filter((t) => t.length > 0);
  const kept: string[] = [];
  for (const token of tokens) {
    if (NOISE.has(token)) continue;
    if (/^\d+$/.test(token)) continue;
    if (token.length < 2) continue;
    const digits = (token.match(/\d/g) ?? []).length;
    if (digits >= 4) continue;
    kept.push(token);
    if (kept.length === 2) break;
  }
  if (kept.length === 0) return 'Unknown';
  return kept.map(titleCase).join(' ');
}

const RULES: ReadonlyArray<readonly [Category, RegExp]> = [
  ['Salary', /\b(salary|payroll|stipend)\b/],
  ['Rent', /\b(rent|nobroker|landlord)\b/],
  ['EMI', /\b(emi|loan|bajaj ?fin|nbfc)\b/],
  ['Subscriptions', /\b(netflix|spotify|hotstar|prime video|youtube|jiocinema|zee5|sonyliv|google one|icloud|subscription)\b/],
  ['Groceries', /\b(bigbasket|blinkit|zepto|grofers|dmart|instamart|supermarket|reliance fresh|more retail|grocer)/],
  ['Food', /\b(swiggy|zomato|dominos|mcdonald|kfc|starbucks|cafe|restaurant|pizza|burger|eatfit|dineout)/],
  ['Travel', /\b(uber|ola|irctc|makemytrip|redbus|indigo|goibibo|rapido|fastag|metro|airlines|cleartrip)\b/],
  ['Shopping', /\b(amazon|flipkart|myntra|ajio|nykaa|meesho|tatacliq|decathlon)\b/],
  ['Health', /\b(apollo|pharmeasy|1mg|hospital|clinic|medplus|netmeds|pharmacy|diagnostic|lab)\b/],
  ['Education', /\b(byju|udemy|coursera|unacademy|school|college|tuition|edtech)\b/],
  ['Entertainment', /\b(bookmyshow|pvr|inox|steam|cinema|gaming)\b/],
  ['Bills', /\b(airtel|jio|vodafone|bsnl|electricity|bescom|msedcl|tata power|broadband|fibernet|gas|water|bill)\b/]
];

export function keywordCategory(text: string): Category | null {
  const lower = text.toLowerCase();
  for (const [category, pattern] of RULES) {
    if (pattern.test(lower)) return category;
  }
  return null;
}

export function cosine(a: ArrayLike<number>, b: ArrayLike<number>): number {
  if (a.length !== b.length) throw new RangeError('embedding length mismatch');
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export function assertEmbedding(vector: ArrayLike<number>): void {
  if (vector.length !== EMBEDDING_DIM) {
    throw new RangeError(`embedding must have ${EMBEDDING_DIM} dimensions, got ${vector.length}`);
  }
}

export interface Neighbor {
  merchant: string;
  category: Category;
  similarity: number;
}

export interface CategorizeResult {
  category: Category;
  source: 'model' | 'rule' | 'none';
  confidence: number;
  neighbors: Neighbor[];
}

export function nearestNeighbors(
  embedding: ArrayLike<number>,
  entries: readonly CategorizationEntry[],
  k: number = KNN_K
): Neighbor[] {
  assertEmbedding(embedding);
  const scored: Neighbor[] = [];
  for (const entry of entries) {
    if (entry.embedding.length !== EMBEDDING_DIM) continue;
    scored.push({ merchant: entry.merchant, category: entry.category, similarity: cosine(embedding, entry.embedding) });
  }
  scored.sort((x, y) => y.similarity - x.similarity || (x.merchant < y.merchant ? -1 : x.merchant > y.merchant ? 1 : 0));
  return scored.slice(0, k);
}

export function categorize(
  merchant: string,
  description: string,
  embedding: ArrayLike<number> | null,
  entries: readonly CategorizationEntry[]
): CategorizeResult {
  const exact = entries.find((e) => e.merchant === merchant);
  if (exact) return { category: exact.category, source: 'model', confidence: 1, neighbors: [] };
  if (embedding) {
    const neighbors = nearestNeighbors(embedding, entries).filter((n) => n.similarity >= MIN_SIMILARITY);
    if (neighbors.length > 0) {
      const weights = new Map<Category, number>();
      let total = 0;
      for (const n of neighbors) {
        weights.set(n.category, (weights.get(n.category) ?? 0) + n.similarity);
        total += n.similarity;
      }
      let best: Category = 'Other';
      let bestWeight = -1;
      for (const category of CATEGORIES) {
        const w = weights.get(category) ?? 0;
        if (w > bestWeight) {
          best = category;
          bestWeight = w;
        }
      }
      const top = neighbors[0]?.similarity ?? 0;
      return { category: best, source: 'model', confidence: (bestWeight / total) * top, neighbors };
    }
  }
  const rule = keywordCategory(`${merchant} ${description}`);
  if (rule) return { category: rule, source: 'rule', confidence: 0.6, neighbors: [] };
  return { category: 'Other', source: 'none', confidence: 0, neighbors: [] };
}

function normalizeVector(v: number[]): number[] {
  let sum = 0;
  for (const x of v) sum += x * x;
  const norm = Math.sqrt(sum);
  return norm === 0 ? v : v.map((x) => x / norm);
}

export function updateCentroid(
  existing: CategorizationEntry | undefined,
  merchant: string,
  category: Category,
  embedding: ArrayLike<number>,
  now: string
): CategorizationEntry {
  assertEmbedding(embedding);
  const incoming = normalizeVector(Array.from(embedding));
  if (!existing || existing.category !== category) {
    return { merchant, category, embedding: incoming, sampleCount: 1, updatedAt: now };
  }
  const n = existing.sampleCount;
  const merged = existing.embedding.map((x, i) => (x * n + (incoming[i] ?? 0)) / (n + 1));
  return { merchant, category, embedding: normalizeVector(merged), sampleCount: n + 1, updatedAt: now };
}

export interface CategoryChange {
  transactionId: string;
  merchant: string;
  from: Category;
  to: Category;
}

export interface CorrectionResult {
  entries: CategorizationEntry[];
  transactions: Transaction[];
  changes: CategoryChange[];
}

export function propagateCorrection(
  correction: { merchant: string; category: Category },
  embedding: ArrayLike<number> | null,
  transactions: readonly Transaction[],
  entries: readonly CategorizationEntry[],
  now: string
): CorrectionResult {
  let nextEntries = entries.slice();
  const index = nextEntries.findIndex((e) => e.merchant === correction.merchant);
  if (embedding) {
    const updated = updateCentroid(index >= 0 ? nextEntries[index] : undefined, correction.merchant, correction.category, embedding, now);
    if (index >= 0) nextEntries[index] = updated;
    else nextEntries = [...nextEntries, updated];
  } else if (index >= 0) {
    const current = nextEntries[index];
    if (current) nextEntries[index] = { ...current, category: correction.category, updatedAt: now };
  } else {
    nextEntries = [
      ...nextEntries,
      { merchant: correction.merchant, category: correction.category, embedding: new Array<number>(EMBEDDING_DIM).fill(0), sampleCount: 1, updatedAt: now }
    ];
  }
  const byMerchant = new Map(entries.map((e) => [e.merchant, e.embedding] as const));
  const changes: CategoryChange[] = [];
  const updatedTxns = transactions.map((t) => {
    if (t.category === correction.category && t.categorySource === 'user') return t;
    let match = t.merchant === correction.merchant;
    if (!match && embedding && t.categorySource !== 'user') {
      const other = byMerchant.get(t.merchant);
      if (other && other.length === EMBEDDING_DIM && cosine(embedding, other) >= PROPAGATION_SIMILARITY) match = true;
    }
    if (!match) return t;
    if (t.category !== correction.category) {
      changes.push({ transactionId: t.id, merchant: t.merchant, from: t.category, to: correction.category });
    }
    return { ...t, category: correction.category, categorySource: 'user' as const };
  });
  return { entries: nextEntries, transactions: updatedTxns, changes };
}
