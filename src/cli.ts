import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { loadConfig } from './config';
import { getRepoRoot } from './git';
import { renderSummary } from './output';
import { redactAllFiles, redactPaths } from './redact';
import { scanAllFiles, scanPaths, scanStagedFiles } from './scanner';

function readPackageVersion(): string {
  try {
    const pkgPath = path.resolve(__dirname, '..', 'package.json');
    const raw = fs.readFileSync(pkgPath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.version === 'string') {
      return parsed.version;
    }
  } catch {
    return '0.0.0';
  }
  return '0.0.0';
}

function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unexpected error.';
}

const program = new Command();

program
  .name('secret-scanner')
  .description('Prevent committing secrets by scanning files for values found in .env files.')
  .option('-c, --config <path>', 'Path to config file')
  .option('--cwd <path>', 'Working directory', process.cwd())
  .option('--json', 'JSON output')
  .option('--plain', 'Plain output (one finding per line)')
  .option('-q, --quiet', 'Suppress non-essential output')
  .option('-v, --verbose', 'Verbose output')
  .option('--no-color', 'Disable ANSI colors')
  .version(readPackageVersion());

program
  .command('scan', { isDefault: true })
  .description('Scan files for secrets')
  .option('--staged', 'Scan staged files (git)')
  .option('--all', 'Scan all tracked files (git)')
  .option('--include-untracked', 'Include untracked files with --all')
  .option('--paths <paths...>', 'Scan specific paths or globs')
  .action((options) => {
    try {
      const globalOptions = program.opts();
      const cwd = path.resolve(globalOptions.cwd);
      const { config } = loadConfig({ cwd, configPath: globalOptions.config });

      if (globalOptions.json && globalOptions.plain) {
        console.error('Choose either --json or --plain, not both.');
        process.exitCode = 2;
        return;
      }

      const wantsStaged = Boolean(options.staged);
      const wantsAll = Boolean(options.all);
      const wantsPaths = Array.isArray(options.paths) && options.paths.length > 0;

      if ([wantsStaged, wantsAll, wantsPaths].filter(Boolean).length > 1) {
        console.error('Use only one of --staged, --all, or --paths.');
        process.exitCode = 2;
        return;
      }

      let summary;
      if (wantsStaged) {
        summary = scanStagedFiles({ cwd, config });
      } else if (wantsAll) {
        summary = scanAllFiles({
          cwd,
          config,
          includeUntracked: Boolean(options.includeUntracked),
        });
      } else if (wantsPaths) {
        summary = scanPaths({ cwd, config, paths: options.paths });
      } else {
        const repoRoot = getRepoRoot(cwd);
        if (repoRoot) {
          summary = scanStagedFiles({ cwd, config });
        } else {
          console.error('Not in a git repo. Use --paths to scan specific files.');
          process.exitCode = 2;
          return;
        }
      }

      const rendered = renderSummary(summary, {
        mode: globalOptions.json ? 'json' : globalOptions.plain ? 'plain' : 'human',
        color: Boolean(globalOptions.color),
        quiet: Boolean(globalOptions.quiet),
        verbose: Boolean(globalOptions.verbose),
      });

      if (rendered.stdout) {
        process.stdout.write(rendered.stdout + (rendered.stdout.endsWith('\n') ? '' : '\n'));
      }
      if (rendered.stderr) {
        process.stderr.write(rendered.stderr + (rendered.stderr.endsWith('\n') ? '' : '\n'));
      }

      process.exitCode = rendered.exitCode;
    } catch (error: unknown) {
      console.error(formatErrorMessage(error));
      process.exitCode = 1;
    }
  });

program
  .command('redact')
  .description('Replace secrets in files with safe placeholders')
  .option('--all', 'Redact all tracked files (git)')
  .option('--include-untracked', 'Include untracked files with --all')
  .option('--paths <paths...>', 'Redact specific paths or globs')
  .option('--apply', 'Apply changes to files')
  .option('--dry-run', 'Show what would change (default)')
  .action((options) => {
    try {
      const globalOptions = program.opts();
      const cwd = path.resolve(globalOptions.cwd);
      const { config } = loadConfig({ cwd, configPath: globalOptions.config });

      if (globalOptions.json && globalOptions.plain) {
        console.error('Choose either --json or --plain, not both.');
        process.exitCode = 2;
        return;
      }

      const wantsAll = Boolean(options.all);
      const wantsPaths = Array.isArray(options.paths) && options.paths.length > 0;

      if ([wantsAll, wantsPaths].filter(Boolean).length > 1) {
        console.error('Use only one of --all or --paths.');
        process.exitCode = 2;
        return;
      }

      const apply = Boolean(options.apply);
      const dryRun = Boolean(options.dryRun) || !apply;
      if (apply && options.dryRun) {
        console.error('Use either --apply or --dry-run, not both.');
        process.exitCode = 2;
        return;
      }

      const summary = wantsPaths
        ? redactPaths({ cwd, config, apply, paths: options.paths })
        : redactAllFiles({
            cwd,
            config,
            apply,
            includeUntracked: Boolean(options.includeUntracked),
          });

      if (globalOptions.json) {
        const payload = {
          ok: summary.filesChanged === 0,
          mode: summary.mode,
          rootDir: summary.rootDir,
          filesScanned: summary.filesScanned,
          filesChanged: summary.filesChanged,
          secretCount: summary.secretCount,
          results: summary.results,
        };
        process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
        process.exitCode = summary.filesChanged === 0 ? 0 : 1;
        return;
      }

      if (globalOptions.plain) {
        const lines = summary.results.map(
          (result) => `${result.filePath}\t${result.keys.join(',')}`,
        );
        if (lines.length > 0) {
          process.stdout.write(lines.join('\n') + '\n');
        }
        process.exitCode = summary.filesChanged === 0 ? 0 : 1;
        return;
      }

      if (summary.filesChanged === 0) {
        if (!globalOptions.quiet) {
          process.stdout.write('No secrets to redact.\n');
        }
        process.exitCode = 0;
        return;
      }

      process.stdout.write('Secrets redacted:\n');
      for (const result of summary.results) {
        process.stdout.write(`- ${result.filePath}\n`);
        for (const key of result.keys) {
          process.stdout.write(`  - ${key}\n`);
        }
      }

      if (dryRun) {
        process.stdout.write('\nDry run only. Re-run with --apply to write changes.\n');
      }

      process.exitCode = 1;
    } catch (error: unknown) {
      console.error(formatErrorMessage(error));
      process.exitCode = 1;
    }
  });

program
  .command('init')
  .description('Create a default config file')
  .option('-p, --path <path>', 'Config file path', 'secret-scanner.config.json')
  .option('-f, --force', 'Overwrite if the config file already exists')
  .action((options) => {
    const globalOptions = program.opts();
    const cwd = path.resolve(globalOptions.cwd);
    const configPath = path.resolve(cwd, options.path);

    if (fs.existsSync(configPath) && !options.force) {
      console.error(`Config already exists at ${configPath}. Use --force to overwrite.`);
      process.exitCode = 2;
      return;
    }

    const defaultConfig = {
      envFileGlobs: ['.env', '.env.*'],
      envFileExcludes: ['.env.example'],
      ignoreFileGlobs: [
        '**/node_modules/**',
        '**/.git/**',
        '**/.next/**',
        '**/dist/**',
        '**/build/**',
        '**/coverage/**',
        '**/.turbo/**',
      ],
      allowFileGlobs: [],
      minSecretLength: 8,
      commonValues: [
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
      ],
      binaryExtensions: [
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
      ],
    };

    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2) + '\n', 'utf-8');
    process.stdout.write(`Wrote config to ${configPath}\n`);
  });

program.parse(process.argv);
