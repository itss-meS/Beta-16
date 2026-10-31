import { FinanceNative } from '@plugins/finance-native';
import { EMBEDDING_DIM } from '@/core/categorize';

export async function embedTexts(texts: readonly string[]): Promise<number[][] | null> {
  if (texts.length === 0) return [];
  try {
    const { vectors } = await FinanceNative.embed({ texts: [...texts] });
    if (vectors.length !== texts.length) return null;
    if (vectors.some((v) => v.length !== EMBEDDING_DIM)) return null;
    return vectors;
  } catch {
    return null;
  }
}
