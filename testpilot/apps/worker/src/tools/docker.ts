import { spawn } from 'node:child_process';
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

const TIMEOUT_MS = 5 * 60 * 1000;
const JACOCO_REPORT_PATH = 'build/reports/jacoco/test/jacocoTestReport.xml';

export interface SandboxResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  jacocoXml: string | null;
}

function extractPackage(sourceCode: string): string {
  const m = sourceCode.match(/^\s*package\s+([\w.]+)\s*;/m);
  return m ? m[1] : 'com.example';
}

export function generateBuildGradle(): string {
  return `plugins {
    java
    jacoco
}

repositories {
    mavenCentral()
}

dependencies {
    testImplementation("org.junit.jupiter:junit-jupiter:5.10.0")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

java {
    toolchain {
        languageVersion.set(JavaLanguageVersion.of(21))
    }
}

tasks.test {
    useJUnitPlatform()
    finalizedBy(tasks.jacocoTestReport)
}

tasks.jacocoTestReport {
    dependsOn(tasks.test)
    reports {
        xml.required.set(true)
    }
}
`;
}

export function buildProjectLayout(
  sourceCode: string,
  className: string,
  testCode: string,
): Record<string, string> {
  const pkg = extractPackage(sourceCode);
  const pkgPath = pkg.replace(/\./g, '/');
  return {
    'build.gradle.kts': generateBuildGradle(),
    'settings.gradle.kts': 'rootProject.name = "testpilot-sandbox"\n',
    [`src/main/java/${pkgPath}/${className}.java`]: sourceCode,
    [`src/test/java/${pkgPath}/${className}Test.java`]: testCode,
  };
}

export async function runInSandbox(options: {
  sourceCode: string;
  className: string;
  testCode: string;
}): Promise<SandboxResult> {
  const { sourceCode, className, testCode } = options;
  const workDir = join(tmpdir(), `testpilot-${randomUUID()}`);

  try {
    const layout = buildProjectLayout(sourceCode, className, testCode);
    for (const [filePath, content] of Object.entries(layout)) {
      const abs = join(workDir, filePath);
      await mkdir(join(abs, '..'), { recursive: true });
      await writeFile(abs, content, 'utf-8');
    }

    const { exitCode, stdout, stderr } = await runGradle(workDir);

    let jacocoXml: string | null = null;
    try {
      jacocoXml = await readFile(join(workDir, JACOCO_REPORT_PATH), 'utf-8');
    } catch {
      // JaCoCo report not produced — compile error or all tests failed before the report task ran
    }

    return { exitCode, stdout, stderr, jacocoXml };
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

function runGradle(cwd: string): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const isWindows = process.platform === 'win32';
    const env = { ...process.env };
    // On Windows dev machines, Java 25 is default but Gradle needs ≤24.
    if (!env['JAVA_HOME'] && isWindows) {
      env['JAVA_HOME'] = 'C:\\Program Files\\Eclipse Adoptium\\jdk-17.0.18.8-hotspot';
    }
    // .bat files require shell: true on Windows; on Linux gradle is a plain binary.
    const [cmd, args, opts] = isWindows
      ? ['gradle', ['test', 'jacocoTestReport', '--no-daemon'], { cwd, env, shell: true }]
      : ['gradle', ['test', 'jacocoTestReport', '--no-daemon'], { cwd, env }];
    const proc = spawn(cmd, args, opts);

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    proc.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
    proc.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error('Gradle timed out after 5 minutes'));
    }, TIMEOUT_MS);

    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        exitCode: code ?? 1,
        stdout: Buffer.concat(stdoutChunks).toString('utf-8'),
        stderr: Buffer.concat(stderrChunks).toString('utf-8'),
      });
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}
