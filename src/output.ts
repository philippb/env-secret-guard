import pc from 'picocolors';
import { ScanSummary } from './scanner';

export type OutputMode = 'human' | 'plain' | 'json';

export interface OutputOptions {
  mode: OutputMode;
  color: boolean;
  quiet: boolean;
  verbose: boolean;
}

export interface RenderedOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
}

function colorize(enabled: boolean) {
  if (!enabled) {
    return {
      green: (text: string) => text,
      red: (text: string) => text,
      yellow: (text: string) => text,
      dim: (text: string) => text,
      bold: (text: string) => text,
    };
  }
  return {
    green: pc.green,
    red: pc.red,
    yellow: pc.yellow,
    dim: pc.dim,
    bold: pc.bold,
  };
}

export function renderSummary(summary: ScanSummary, options: OutputOptions): RenderedOutput {
  const { green, red, yellow, dim, bold } = colorize(options.color);

  if (options.mode === 'json') {
    return {
      stdout: JSON.stringify({
        ok: summary.findings.length === 0,
        mode: summary.mode,
        rootDir: summary.rootDir,
        filesScanned: summary.filesScanned,
        envFileCount: summary.envFileCount,
        secretCount: summary.secretCount,
        findings: summary.findings,
      }, null, 2),
      stderr: '',
      exitCode: summary.findings.length === 0 ? 0 : 1,
    };
  }

  if (options.mode === 'plain') {
    const lines: string[] = [];
    for (const finding of summary.findings) {
      for (const match of finding.matches) {
        lines.push(`${finding.filePath}\t${match.key}\t${match.envFile}`);
      }
    }
    return {
      stdout: lines.join('\n'),
      stderr: '',
      exitCode: summary.findings.length === 0 ? 0 : 1,
    };
  }

  if (summary.findings.length === 0) {
    if (options.quiet) {
      return { stdout: '', stderr: '', exitCode: 0 };
    }
    return {
      stdout: green('No secrets found.'),
      stderr: '',
      exitCode: 0,
    };
  }

  const lines: string[] = [];
  lines.push(red(bold('Secrets detected.')));
  lines.push(dim(`Mode: ${summary.mode}`));
  lines.push(dim(`Files scanned: ${summary.filesScanned}`));

  for (const finding of summary.findings) {
    lines.push('');
    lines.push(yellow(finding.filePath));
    for (const match of finding.matches) {
      lines.push(`  - ${match.key} (${match.envFile})`);
    }
  }

  return {
    stdout: lines.join('\n'),
    stderr: '',
    exitCode: 1,
  };
}
