import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'node:child_process';
import { buildProjectLayout, generateBuildGradle, runInSandbox } from './docker.js';

// ─── Unit: buildProjectLayout ─────────────────────────────────────────────────

describe('buildProjectLayout', () => {
  const source = `package com.example;\npublic class Calculator { public int add(int a, int b) { return a + b; } }`;
  const test   = `package com.example;\nimport org.junit.jupiter.api.Test;\nimport static org.junit.jupiter.api.Assertions.*;\nclass CalculatorTest { @Test void testAdd() { assertEquals(3, new Calculator().add(1, 2)); } }`;

  it('places the source file at the correct package path', () => {
    const layout = buildProjectLayout(source, 'Calculator', test);
    expect(layout['src/main/java/com/example/Calculator.java']).toBe(source);
  });

  it('places the test file at the correct package path', () => {
    const layout = buildProjectLayout(source, 'Calculator', test);
    expect(layout['src/test/java/com/example/CalculatorTest.java']).toBe(test);
  });

  it('includes a build.gradle.kts entry', () => {
    const layout = buildProjectLayout(source, 'Calculator', test);
    expect(layout['build.gradle.kts']).toBeDefined();
    expect(layout['build.gradle.kts'].length).toBeGreaterThan(0);
  });

  it('includes a settings.gradle.kts entry', () => {
    const layout = buildProjectLayout(source, 'Calculator', test);
    expect(layout['settings.gradle.kts']).toBeDefined();
  });

  it('defaults to com.example when source has no package declaration', () => {
    const noPackage = `public class Foo { }`;
    const layout = buildProjectLayout(noPackage, 'Foo', '');
    expect(layout['src/main/java/com/example/Foo.java']).toBe(noPackage);
  });

  it('converts multi-segment package to nested directory path', () => {
    const deep = `package org.acme.utils;\npublic class Helper { }`;
    const layout = buildProjectLayout(deep, 'Helper', '');
    expect(layout['src/main/java/org/acme/utils/Helper.java']).toBe(deep);
  });
});

// ─── Unit: generateBuildGradle ────────────────────────────────────────────────

describe('generateBuildGradle', () => {
  it('declares the jacoco plugin', () => {
    expect(generateBuildGradle()).toMatch(/jacoco/);
  });

  it('declares the java plugin', () => {
    expect(generateBuildGradle()).toMatch(/\bjava\b/);
  });

  it('includes the JUnit 5 dependency', () => {
    expect(generateBuildGradle()).toMatch(/junit-jupiter/);
  });

  it('enables the JUnit platform test runner', () => {
    expect(generateBuildGradle()).toMatch(/useJUnitPlatform/);
  });

  it('enables XML report output for JaCoCo', () => {
    expect(generateBuildGradle()).toMatch(/xml\.required/);
  });
});

// ─── Integration: runInSandbox (requires Gradle on PATH) ─────────────────────

const PASSING_SOURCE = `package com.example;
public class Calculator {
    public int add(int a, int b) { return a + b; }
}`;

const PASSING_TEST = `package com.example;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
class CalculatorTest {
    @Test void testAdd() { assertEquals(3, new Calculator().add(1, 2)); }
}`;

const FAILING_TEST = `package com.example;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
class CalculatorTest {
    @Test void testAdd() { assertEquals(999, new Calculator().add(1, 2)); }
}`;

let gradleAvailable = false;

describe('runInSandbox (integration — requires Gradle on PATH)', () => {
  beforeAll(() => {
    try {
      execSync('gradle --version', { stdio: 'ignore' });
      gradleAvailable = true;
    } catch {
      gradleAvailable = false;
      console.warn('Gradle not on PATH — skipping integration tests');
    }
  });

  it('returns exitCode 0 when tests pass', async () => {
    if (!gradleAvailable) return;
    const result = await runInSandbox({
      sourceCode: PASSING_SOURCE,
      className: 'Calculator',
      testCode: PASSING_TEST,
    });
    expect(result.exitCode).toBe(0);
  }, 180_000);

  it('returns non-null jacocoXml when tests pass', async () => {
    if (!gradleAvailable) return;
    const result = await runInSandbox({
      sourceCode: PASSING_SOURCE,
      className: 'Calculator',
      testCode: PASSING_TEST,
    });
    expect(result.jacocoXml).not.toBeNull();
    expect(result.jacocoXml).toMatch(/^<\?xml/);
  }, 180_000);

  it('returns exitCode 1 when tests fail', async () => {
    if (!gradleAvailable) return;
    const result = await runInSandbox({
      sourceCode: PASSING_SOURCE,
      className: 'Calculator',
      testCode: FAILING_TEST,
    });
    expect(result.exitCode).not.toBe(0);
  }, 180_000);

  it('captures stdout output from the Gradle run', async () => {
    if (!gradleAvailable) return;
    const result = await runInSandbox({
      sourceCode: PASSING_SOURCE,
      className: 'Calculator',
      testCode: PASSING_TEST,
    });
    expect(result.stdout.length).toBeGreaterThan(0);
  }, 180_000);
});
