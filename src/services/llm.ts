import { FinanceNative } from '@plugins/finance-native';
import type { LlmStatus } from '@plugins/definitions';
import { randomId } from '@/utils/crypto';

const OFFLINE: LlmStatus = { available: false, model: null, adapters: [], activeAdapter: null };

export async function readLlmStatus(): Promise<LlmStatus> {
  try {
    return await FinanceNative.llmStatus();
  } catch {
    return OFFLINE;
  }
}

export async function generateText(prompt: string, maxNewTokens: number, onToken: (token: string) => void): Promise<string> {
  const requestId = randomId('llm');
  const handle = await FinanceNative.addListener('llmToken', (event) => {
    if (event.requestId === requestId) onToken(event.token);
  });
  try {
    const { text } = await FinanceNative.llmGenerate({ prompt, maxNewTokens, requestId });
    return text;
  } finally {
    await handle.remove();
  }
}

export async function cancelGeneration(requestId: string): Promise<void> {
  try {
    await FinanceNative.llmCancel({ requestId });
  } catch {
    return;
  }
}
