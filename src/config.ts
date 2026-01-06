import fs from 'fs';
import os from 'os';
import path from 'path';

export interface SecretScannerConfig {
  envFiles?: string[];
  envFileGlobs?: string[];
  envFileExcludes?: string[];
  ignoreFileGlobs?: string[];
  allowFileGlobs?: string[];
  minSecretLength?: number;
  commonValues?: string[];
  binaryExtensions?: string[];
}

export interface LoadedConfig {
  config: Required<SecretScannerConfig>;
  sources: string[];
}

const DEFAULT_COMMON_VALUES = [
  'true',
  'false',
  'null',
  'undefined',
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '3000',
  '3001',
  '3002',
  '5432',
  '8080',
  '8000',
  'development',
  'production',
  'test',
  'staging',
  'dev',
  'prod',
  '',
];

const DEFAULT_IGNORE_GLOBS = [
  '**/node_modules/**',
  '**/.git/**',
  '**/.next/**',
  '**/dist/**',
  '**/build/**',
  '**/coverage/**',
  '**/.turbo/**',
];

const DEFAULT_BINARY_EXTENSIONS = [
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.pdf',
  '.zip',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
];

export const DEFAULT_CONFIG: Required<SecretScannerConfig> = {
  envFiles: [],
  envFileGlobs: ['.env', '.env.*'],
  envFileExcludes: ['.env.example'],
  ignoreFileGlobs: DEFAULT_IGNORE_GLOBS,
  allowFileGlobs: [],
  minSecretLength: 8,
  commonValues: DEFAULT_COMMON_VALUES,
  binaryExtensions: DEFAULT_BINARY_EXTENSIONS,
};

const PROJECT_CONFIG_FILES = ['secret-scanner.config.json', '.secret-scanner.json'];

function readJsonConfig(filePath: string): SecretScannerConfig {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(raw);
  if (parsed && typeof parsed === 'object') {
    return parsed as SecretScannerConfig;
  }
  throw new Error(`Invalid config file: ${filePath}`);
}

function mergeConfig(base: Required<SecretScannerConfig>, override?: SecretScannerConfig): Required<SecretScannerConfig> {
  if (!override) return base;
  return {
    envFiles: Array.isArray(override.envFiles) ? override.envFiles : base.envFiles,
    envFileGlobs: Array.isArray(override.envFileGlobs) ? override.envFileGlobs : base.envFileGlobs,
    envFileExcludes: Array.isArray(override.envFileExcludes) ? override.envFileExcludes : base.envFileExcludes,
    ignoreFileGlobs: Array.isArray(override.ignoreFileGlobs) ? override.ignoreFileGlobs : base.ignoreFileGlobs,
    allowFileGlobs: Array.isArray(override.allowFileGlobs) ? override.allowFileGlobs : base.allowFileGlobs,
    minSecretLength: typeof override.minSecretLength === 'number' ? override.minSecretLength : base.minSecretLength,
    commonValues: Array.isArray(override.commonValues) ? override.commonValues : base.commonValues,
    binaryExtensions: Array.isArray(override.binaryExtensions) ? override.binaryExtensions : base.binaryExtensions,
  };
}

function resolveUserConfigPath(): string {
  const xdg = process.env.XDG_CONFIG_HOME;
  if (xdg) {
    return path.join(xdg, 'secret-scanner', 'config.json');
  }
  return path.join(os.homedir(), '.config', 'secret-scanner', 'config.json');
}

function findProjectConfigPath(cwd: string): string | null {
  for (const file of PROJECT_CONFIG_FILES) {
    const candidate = path.join(cwd, file);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

export function loadConfig(options: { cwd: string; configPath?: string }): LoadedConfig {
  const sources: string[] = [];
  let config = DEFAULT_CONFIG;

  const explicitPath = options.configPath || process.env.SECRET_SCANNER_CONFIG;
  if (explicitPath) {
    const resolved = path.resolve(options.cwd, explicitPath);
    if (!fs.existsSync(resolved)) {
      throw new Error(`Config file not found: ${resolved}`);
    }
    config = mergeConfig(config, readJsonConfig(resolved));
    sources.push(resolved);
    return { config, sources };
  }

  const userConfigPath = resolveUserConfigPath();
  if (fs.existsSync(userConfigPath)) {
    config = mergeConfig(config, readJsonConfig(userConfigPath));
    sources.push(userConfigPath);
  }

  const projectConfigPath = findProjectConfigPath(options.cwd);
  if (projectConfigPath) {
    config = mergeConfig(config, readJsonConfig(projectConfigPath));
    sources.push(projectConfigPath);
  }

  return { config, sources };
}
