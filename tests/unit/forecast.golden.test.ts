import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { runForecast, type ForecastInput } from '@/core/forecast';

interface Scenario {
  name: string;
  input: ForecastInput;
  expected: {
    status: string;
    confidence: string;
    reasons: { code: string; blocking: boolean }[];
    steps: { key: string; p10: number; p50: number; p90: number }[];
    available: { p10: number; p50: number; p90: number };
    bufferCents: number;
    bands: { day: number; date: string; p10: number; p50: number; p90: number }[];
    uncountedIncomeCents: number;
    gaps: { from: string; to: string }[];
    uncertainSeriesIds: string[];
    historyDays: number;
  };
}

const fixture = JSON.parse(
  readFileSync(new URL('../../ml/reference/fixtures/forecast_golden.json', import.meta.url), 'utf-8')
) as { version: number; scenarios: Scenario[] };

describe('ForecastEngine matches the Python reference', () => {
  for (const scenario of fixture.scenarios) {
    it(scenario.name, () => {
      const out = runForecast(scenario.input);
      const exp = scenario.expected;
      expect(out.status).toBe(exp.status);
      expect(out.confidence).toBe(exp.confidence);
      expect(out.reasons.map((r) => ({ code: r.code, blocking: r.blocking }))).toEqual(exp.reasons);
      expect(out.steps.map((s) => ({ key: s.key, p10: s.p10, p50: s.p50, p90: s.p90 }))).toEqual(exp.steps);
      expect(out.available).toEqual(exp.available);
      expect(out.bufferCents).toBe(exp.bufferCents);
      expect(out.bands).toEqual(exp.bands);
      expect(out.uncountedIncomeCents).toBe(exp.uncountedIncomeCents);
      expect(out.gaps).toEqual(exp.gaps);
      expect(out.uncertainSeriesIds).toEqual(exp.uncertainSeriesIds);
      expect(out.assumptions.historyDays).toBe(exp.historyDays);
    });
  }
});
