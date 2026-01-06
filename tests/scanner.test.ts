import fs from 'fs';
import os from 'os';
import path from 'path';
import { execSync } from 'child_process';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../src/config';
import { scanAllFiles, scanHistoryFiles, scanPaths, scanStagedFiles } from '../src/scanner';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'secret-scanner-'));
}

describe('scanner', () => {
  it('detects secrets in files', () => {
    const dir = makeTempDir();
    fs.writeFileSync(path.join(dir, '.env'), 'API_KEY=secretvalue123\n', 'utf-8');

    const srcDir = path.join(dir, 'src');
    fs.mkdirSync(srcDir);
    fs.writeFileSync(path.join(srcDir, 'app.ts'), 'const key = "secretvalue123";\n', 'utf-8');
    fs.writeFileSync(path.join(dir, 'README.md'), '# Hello\n', 'utf-8');

    const summary = scanPaths({
      cwd: dir,
      config: { ...DEFAULT_CONFIG, envFileGlobs: ['.env'] },
      paths: ['src/app.ts', 'README.md'],
    });

    expect(summary.findings).toHaveLength(1);
    expect(summary.findings[0].filePath.endsWith('src/app.ts')).toBe(true);
    expect(summary.findings[0].matches[0].key).toBe('API_KEY');
  });

  it('skips binary files', () => {
    const dir = makeTempDir();
    fs.writeFileSync(path.join(dir, '.env'), 'TOKEN=secretbinary123\n', 'utf-8');
    fs.writeFileSync(path.join(dir, 'image.png'), Buffer.from([0, 1, 2, 3]));

    const summary = scanPaths({
      cwd: dir,
      config: { ...DEFAULT_CONFIG, envFileGlobs: ['.env'] },
      paths: ['image.png'],
    });

    expect(summary.findings).toHaveLength(0);
  });

  it('scans staged content from index by default', () => {
    const dir = makeTempDir();
    execSync('git init', { cwd: dir });

    fs.writeFileSync(path.join(dir, '.env'), 'API_KEY=secretvalue123\n', 'utf-8');

    const srcDir = path.join(dir, 'src');
    fs.mkdirSync(srcDir);
    const filePath = path.join(srcDir, 'app.ts');
    fs.writeFileSync(filePath, 'const key = "secretvalue123";\n', 'utf-8');
    execSync('git add src/app.ts', { cwd: dir });

    fs.writeFileSync(filePath, 'const key = "nope";\n', 'utf-8');

    const summary = scanStagedFiles({
      cwd: dir,
      config: { ...DEFAULT_CONFIG, envFileGlobs: ['.env'] },
    });

    expect(summary.findings).toHaveLength(1);
  });

  it('scans working tree content for tracked files', () => {
    const dir = makeTempDir();
    execSync('git init', { cwd: dir });

    fs.writeFileSync(path.join(dir, '.env'), 'API_KEY=secretvalue123\n', 'utf-8');

    const srcDir = path.join(dir, 'src');
    fs.mkdirSync(srcDir);
    const filePath = path.join(srcDir, 'app.ts');
    fs.writeFileSync(filePath, 'const key = "secretvalue123";\n', 'utf-8');
    execSync('git add src/app.ts', { cwd: dir });

    fs.writeFileSync(filePath, 'const key = "nope";\n', 'utf-8');

    const summary = scanAllFiles({
      cwd: dir,
      config: { ...DEFAULT_CONFIG, envFileGlobs: ['.env'] },
    });

    expect(summary.findings).toHaveLength(0);
  });

  it('scans git history for secrets', () => {
    const dir = makeTempDir();
    execSync('git init', { cwd: dir });
    execSync('git config user.email "test@example.com"', { cwd: dir });
    execSync('git config user.name "Test User"', { cwd: dir });

    fs.writeFileSync(path.join(dir, '.env'), 'API_KEY=secretvalue123\n', 'utf-8');

    const srcDir = path.join(dir, 'src');
    fs.mkdirSync(srcDir);
    const filePath = path.join(srcDir, 'app.ts');
    fs.writeFileSync(filePath, 'const key = "secretvalue123";\n', 'utf-8');
    execSync('git add .env src/app.ts', { cwd: dir });
    execSync('git commit -m "add secret"', { cwd: dir });

    fs.writeFileSync(filePath, 'const key = "nope";\n', 'utf-8');
    execSync('git add src/app.ts', { cwd: dir });
    execSync('git commit -m "remove secret"', { cwd: dir });

    const summary = scanHistoryFiles({
      cwd: dir,
      config: { ...DEFAULT_CONFIG, envFileGlobs: ['.env'] },
    });

    expect(summary.findings.length).toBeGreaterThan(0);
    expect(summary.findings.some((finding) => finding.source === 'history')).toBe(true);
    expect(summary.findings.some((finding) => finding.commit)).toBe(true);
    expect(summary.findings.some((finding) => finding.filePath.endsWith('src/app.ts'))).toBe(true);
  });
});
