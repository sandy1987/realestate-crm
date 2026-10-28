import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatArea,
  formatPlotRate,
  formatDate,
  formatDateTime,
} from '../lib/utils/formatters';
import { cn } from '../lib/utils/cn';

describe('Formatters and Utilities', () => {
  it('formats currency numbers accurately', () => {
    const formatted = formatCurrency(2500000);
    expect(formatted).toContain('25,00,000');
  });

  it('formats area with correct units', () => {
    expect(formatArea(200, 'sqyd')).toBe('200 Sq. Yds');
    expect(formatArea(1500, 'sqft')).toBe('1,500 Sq. Ft');
    expect(formatArea(100, 'sqm')).toBe('100 Sq. Mtrs');
    expect(formatArea(2, 'acre')).toBe('2 Acres');
    expect(formatArea(50, 'gaj')).toBe('50 Gaj');
    expect(formatArea(5, 'marla')).toBe('5 Marla');
    expect(formatArea(1, 'kanal')).toBe('1 Kanal');
  });

  it('distinguishes total rate from per-unit rate accurately', () => {
    const totalRate = formatPlotRate(5000000, 'total', 'sqyd');
    expect(totalRate).toContain('50,00,000 Total');

    const perUnitRate = formatPlotRate(4500, 'per_unit', 'sqyd');
    expect(perUnitRate).toContain('4,500 / sq.yd');
  });

  it('formats date and handles null gracefully', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate(undefined)).toBe('—');
    const valid = formatDate('2026-10-26T12:00:00.000Z');
    expect(valid).toContain('2026');
  });

  it('formats date with time', () => {
    expect(formatDateTime(null)).toBe('—');
    const valid = formatDateTime('2026-10-26T12:30:00.000Z');
    expect(valid).toContain('2026');
  });

  it('merges class names correctly with cn()', () => {
    const result = cn('px-4 py-2', 'bg-blue-500', false && 'hidden', 'text-white');
    expect(result).toBe('px-4 py-2 bg-blue-500 text-white');

    // Conflicting tailwind class resolution
    const resolved = cn('p-2', 'p-4');
    expect(resolved).toBe('p-4');
  });
});
