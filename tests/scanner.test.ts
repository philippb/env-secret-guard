import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../src/config';
import { scanPaths } from '../src/scanner';

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
});
