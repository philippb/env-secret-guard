# CLI Reference

Generated from `--help` output. Do not edit by hand.

## secret-scan

```text
Usage: secret-scan [options] [command]

Prevent committing secrets by scanning files for values found in .env files.

Options:
  -c, --config <path>  Path to config file
  --cwd <path>         Working directory (default: ".")
  --json               JSON output
  --plain              Plain output (one finding per line)
  -q, --quiet          Suppress non-essential output
  -v, --verbose        Verbose output
  --no-color           Disable ANSI colors
  -V, --version        output the version number
  -h, --help           display help for command

Commands:
  scan [options]       Scan files for secrets
  redact [options]     Replace secrets in files with safe placeholders
  init [options]       Create a default config file
  help [command]       display help for command
```

## secret-scan scan

```text
Usage: secret-scan scan [options]

Scan files for secrets

Options:
  --staged             Scan staged files (git)
  --all                Scan all tracked files (git)
  --include-untracked  Include untracked files with --all
  --paths <paths...>   Scan specific paths or globs
  -h, --help           display help for command
```

## secret-scan redact

```text
Usage: secret-scan redact [options]

Replace secrets in files with safe placeholders

Options:
  --all                Redact all tracked files (git)
  --include-untracked  Include untracked files with --all
  --paths <paths...>   Redact specific paths or globs
  --apply              Apply changes to files
  --dry-run            Show what would change (default)
  -h, --help           display help for command
```

## secret-scan init

```text
Usage: secret-scan init [options]

Create a default config file

Options:
  -p, --path <path>  Config file path (default: "secret-scan.config.json")
  -f, --force        Overwrite if the config file already exists
  -h, --help         display help for command
```
