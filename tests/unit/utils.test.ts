import { describe, expect, it } from 'vitest';
import {
  addDays, addMonths, compareISO, dayOfWeek, daysInMonth, diffDays, endOfMonth, fixedClock, fromEpochDay,
  isLeapYear, isValidISO, monthKey, parseFlexibleDate, startOfMonth, systemClock, toEpochDay
} from '@/utils/date';
import { divRound, formatCompactINR, formatINR, parseMoneyToCents, percentOf, rupeesToCents, sumCents } from '@/utils/money';
import { createPrng } from '@/utils/prng';
import { fnv1a, hash64, stableId } from '@/utils/hash';
import { randomId, sha256Hex } from '@/utils/crypto';

describe('money', () => {
  it('rounds integer division half away from zero', () => {
    expect(divRound(5, 2)).toBe(3);
    expect(divRound(-5, 2)).toBe(-3);
    expect(divRound(4, 3)).toBe(1);
    expect(divRound(5, -2)).toBe(-3);
    expect(() => divRound(1, 0)).toThrow();
  });
  it('computes percentages in basis points', () => {
    expect(percentOf(100000, 2000)).toBe(20000);
    expect(percentOf(333, 5000)).toBe(167);
  });
  it('sums and converts', () => {
    expect(sumCents([1, 2, 3])).toBe(6);
    expect(rupeesToCents(5)).toBe(500);
    expect(() => rupeesToCents(1.5)).toThrow();
  });
  it('formats with Indian grouping', () => {
    expect(formatINR(12000000)).toBe('₹1,20,000');
    expect(formatINR(-12345)).toBe('-₹123.45');
    expect(formatINR(100, { sign: true })).toBe('+₹1');
    expect(formatINR(0, { paise: 'always' })).toBe('₹0.00');
    expect(formatINR(1999, { paise: 'never' })).toBe('₹20');
    expect(formatINR(123456789000)).toBe('₹1,23,45,67,890');
    expect(formatINR(99900)).toBe('₹999');
    expect(formatINR(100000)).toBe('₹1,000');
  });
  it('formats compact amounts', () => {
    expect(formatCompactINR(50000)).toBe('₹500');
    expect(formatCompactINR(250000)).toBe('₹2.5K');
    expect(formatCompactINR(-1200000)).toBe('-₹12K');
    expect(formatCompactINR(12000000)).toBe('₹1.2L');
    expect(formatCompactINR(2000000000)).toBe('₹2Cr');
  });
  it('parses statement amounts', () => {
    expect(parseMoneyToCents('1,234.50')).toBe(123450);
    expect(parseMoneyToCents('₹ 80,000')).toBe(8000000);
    expect(parseMoneyToCents('Rs. 99.999')).toBe(10000);
    expect(parseMoneyToCents('(250.00)')).toBe(-25000);
    expect(parseMoneyToCents('500.00 Dr')).toBe(-50000);
    expect(parseMoneyToCents('500.00 Cr')).toBe(50000);
    expect(parseMoneyToCents('-45.5')).toBe(-4550);
    expect(parseMoneyToCents('+45')).toBe(4500);
    expect(parseMoneyToCents('.5')).toBe(50);
    expect(parseMoneyToCents('abc')).toBeNull();
    expect(parseMoneyToCents('')).toBeNull();
    expect(parseMoneyToCents('.')).toBeNull();
    expect(parseMoneyToCents('99999999999999999999')).toBeNull();
  });
});

describe('date', () => {
  it('validates and converts', () => {
    expect(isValidISO('2024-02-29')).toBe(true);
    expect(isValidISO('2023-02-29')).toBe(false);
    expect(isValidISO('nope')).toBe(false);
    expect(isLeapYear(1900)).toBe(false);
    expect(isLeapYear(2000)).toBe(true);
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2024, 4)).toBe(30);
    expect(daysInMonth(2024, 5)).toBe(31);
    expect(fromEpochDay(toEpochDay('2025-03-15'))).toBe('2025-03-15');
    expect(() => toEpochDay('bad')).toThrow();
    expect(() => addMonths('bad', 1)).toThrow();
  });
  it('does arithmetic', () => {
    expect(addDays('2025-02-28', 1)).toBe('2025-03-01');
    expect(diffDays('2025-03-01', '2025-02-01')).toBe(28);
    expect(addMonths('2025-01-31', 1)).toBe('2025-02-28');
    expect(addMonths('2025-01-15', -2)).toBe('2024-11-15');
    expect(addMonths('2025-11-15', 3)).toBe('2026-02-15');
    expect(monthKey('2025-03-15')).toBe('2025-03');
    expect(startOfMonth('2025-03-15')).toBe('2025-03-01');
    expect(endOfMonth('2024-02-10')).toBe('2024-02-29');
    expect(dayOfWeek('2025-03-15')).toBe(6);
    expect(dayOfWeek('1969-12-28')).toBe(0);
    expect(compareISO('2025-01-01', '2025-01-02')).toBe(-1);
    expect(compareISO('2025-01-02', '2025-01-01')).toBe(1);
    expect(compareISO('2025-01-01', '2025-01-01')).toBe(0);
  });
  it('parses flexible formats', () => {
    expect(parseFlexibleDate('2025-03-05')).toBe('2025-03-05');
    expect(parseFlexibleDate('05/03/2025')).toBe('2025-03-05');
    expect(parseFlexibleDate('5-3-25')).toBe('2025-03-05');
    expect(parseFlexibleDate('05 Mar 2025')).toBe('2025-03-05');
    expect(parseFlexibleDate('5-Sept-25')).toBe('2025-09-05');
    expect(parseFlexibleDate('31/02/2025')).toBeNull();
    expect(parseFlexibleDate('05 Foo 2025')).toBeNull();
    expect(parseFlexibleDate('hello')).toBeNull();
    expect(parseFlexibleDate('2025-13-01')).toBeNull();
  });
  it('provides clocks', () => {
    expect(fixedClock('2025-01-01')()).toBe('2025-01-01');
    expect(systemClock()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('prng, hash, crypto', () => {
  it('is deterministic and bounded', () => {
    const a = createPrng(42);
    const b = createPrng(42);
    const seqA = Array.from({ length: 5 }, () => a.nextU32());
    const seqB = Array.from({ length: 5 }, () => b.nextU32());
    expect(seqA).toEqual(seqB);
    const c = createPrng(1);
    for (let i = 0; i < 200; i++) {
      const v = c.nextInt(7);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(7);
    }
    expect(() => c.nextInt(0)).toThrow();
    expect(() => c.nextInt(2000000)).toThrow();
    expect(() => c.nextInt(1.5)).toThrow();
  });
  it('hashes stably', () => {
    expect(fnv1a('abc')).toBe('1A47E90B'.toLowerCase());
    expect(hash64('abc')).toHaveLength(16);
    expect(stableId('x', 'a', 1)).toBe(stableId('x', 'a', 1));
    expect(stableId('x', 'a', 1)).not.toBe(stableId('x', 'a', 2));
  });
  it('uses WebCrypto', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(randomId('t')).toMatch(/^t_[0-9a-f]{16}$/);
  });
});
