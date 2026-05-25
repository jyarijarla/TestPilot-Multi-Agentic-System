import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseJacocoCoverage } from './gradle.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) =>
  readFileSync(join(__dirname, 'fixtures', name), 'utf-8');

describe('parseJacocoCoverage', () => {
  it('returns 1.0 for all metrics when coverage is 100%', () => {
    const result = parseJacocoCoverage(fixture('jacoco-full.xml'));
    expect(result.lineCoverage).toBe(1);
    expect(result.branchCoverage).toBe(1);
    expect(result.methodCoverage).toBe(1);
  });

  it('returns correct fractions for partial coverage', () => {
    const result = parseJacocoCoverage(fixture('jacoco-partial.xml'));
    // LINE: 19 covered / (19 + 1 missed) = 0.95
    expect(result.lineCoverage).toBeCloseTo(0.95, 10);
    // BRANCH: 8 covered / (8 + 2 missed) = 0.8
    expect(result.branchCoverage).toBeCloseTo(0.8, 10);
    // METHOD: 5 covered / (5 + 0 missed) = 1.0
    expect(result.methodCoverage).toBe(1);
  });

  it('returns 0 for all metrics (not NaN) when nothing is covered', () => {
    const result = parseJacocoCoverage(fixture('jacoco-zero.xml'));
    expect(result.lineCoverage).toBe(0);
    expect(result.branchCoverage).toBe(0);
    expect(result.methodCoverage).toBe(0);
    // Explicitly confirm no NaN leaked through
    expect(Number.isNaN(result.lineCoverage)).toBe(false);
    expect(Number.isNaN(result.branchCoverage)).toBe(false);
    expect(Number.isNaN(result.methodCoverage)).toBe(false);
  });

  it('returns branchCoverage 0 when no BRANCH counter is present', () => {
    const result = parseJacocoCoverage(fixture('jacoco-no-branch.xml'));
    expect(result.branchCoverage).toBe(0);
    // Other metrics still parse correctly
    // LINE: 9 covered / (9 + 1 missed) = 0.9
    expect(result.lineCoverage).toBeCloseTo(0.9, 10);
    expect(result.methodCoverage).toBe(1);
  });

  it('throws when the XML has no LINE counter (indicates a failed Gradle run)', () => {
    const noLine = `<?xml version="1.0"?><report name="x"><counter type="METHOD" missed="0" covered="1"/></report>`;
    expect(() => parseJacocoCoverage(noLine)).toThrow(/LINE/);
  });

  it('throws when given an empty string', () => {
    expect(() => parseJacocoCoverage('')).toThrow();
  });

  it('throws when given non-XML content', () => {
    expect(() => parseJacocoCoverage('not xml at all {{ garbage }}')).toThrow();
  });

  it('all returned values are numbers in the range [0, 1]', () => {
    const result = parseJacocoCoverage(fixture('jacoco-partial.xml'));
    for (const val of [result.lineCoverage, result.branchCoverage, result.methodCoverage]) {
      expect(typeof val).toBe('number');
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(1);
    }
  });
});
