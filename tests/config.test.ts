import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'secret-scanner-'));
}

describe('config loader', () => {
  it('loads project config when present', () => {
    const dir = makeTempDir();
    const configPath = path.join(dir, 'secret-scanner.config.json');
    fs.writeFileSync(
      configPath,
      JSON.stringify({ minSecretLength: 20 }, null, 2),
      'utf-8'
    );

    const { config, sources } = loadConfig({ cwd: dir });
    expect(config.minSecretLength).toBe(20);
    expect(sources).toContain(configPath);
  });
});
