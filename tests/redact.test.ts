import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../src/config';
import { redactPaths } from '../src/redact';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'secret-scanner-'));
}

describe('redact', () => {
  it('redacts secrets when apply is true', () => {
    const dir = makeTempDir();
    fs.writeFileSync(path.join(dir, '.env'), 'API_KEY=secretvalue123\n', 'utf-8');

    const filePath = path.join(dir, 'app.ts');
    fs.writeFileSync(filePath, 'const key = "secretvalue123";\n', 'utf-8');

    const summary = redactPaths({
      cwd: dir,
      config: { ...DEFAULT_CONFIG, envFileGlobs: ['.env'] },
      apply: true,
      paths: ['app.ts'],
    });

    expect(summary.filesChanged).toBe(1);
    const updated = fs.readFileSync(filePath, 'utf-8');
    expect(updated).toContain('API_KEY');
    expect(updated).toContain('********** (env var: API_KEY)');
    expect(updated).not.toContain('secretvalue123');
  });

  it('does not modify files during dry run', () => {
    const dir = makeTempDir();
    fs.writeFileSync(path.join(dir, '.env'), 'TOKEN=anothersecret\n', 'utf-8');

    const filePath = path.join(dir, 'index.ts');
    fs.writeFileSync(filePath, 'const token = "anothersecret";\n', 'utf-8');

    const summary = redactPaths({
      cwd: dir,
      config: { ...DEFAULT_CONFIG, envFileGlobs: ['.env'] },
      apply: false,
      paths: ['index.ts'],
    });

    expect(summary.filesChanged).toBe(1);
    const updated = fs.readFileSync(filePath, 'utf-8');
    expect(updated).toContain('anothersecret');
  });
});
