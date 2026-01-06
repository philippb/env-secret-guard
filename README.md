# Env Secret Guard

[![npm version](https://img.shields.io/npm/v/@philippb/env-secret-guard)](https://www.npmjs.com/package/@philippb/env-secret-guard)

Env Secret Guard prevents accidental commits of secrets by scanning files for exact values found in your `.env` files. It is designed for use in Git hooks and CI, and intentionally keeps the detection model simple, fast, and explainable.

## Features

- Uses `.env` values as the source of truth (no regex guesswork).
- Scans staged files for safe pre-commit protection.
- Optional working tree scans for CI or local audits.
- Optional git history scans (with `--since` support).
- Human-friendly output plus `--plain` and `--json` modes.

## Install

```bash
pnpm add -D @philippb/env-secret-guard
```

Or run once without installing:

```bash
pnpm dlx @philippb/env-secret-guard scan --staged
```

## Usage

```bash
secret-scan scan --staged
secret-scan scan --working-tree
secret-scan scan --history
secret-scan scan --history --since "2 weeks ago"
secret-scan scan --all
secret-scan scan --paths src apps/api
```

`--all` runs staged, working tree, and history scans together. By default, `--working-tree` and `--all` include untracked files; use `--no-include-untracked` to limit to tracked files.

### Redaction

Redaction replaces exact secret values with a safe placeholder. Dry-run is the default; use `--apply` to write changes.

```bash
secret-scan redact --all --dry-run
secret-scan redact --all --apply
secret-scan redact --paths src apps/api --dry-run
```

Redaction does not rewrite git history. If secrets were committed previously, rotate them and clean history separately.

### Git Hook (Husky)

```bash
pnpm exec secret-scan scan --staged
```

For full setup instructions (Husky and plain Git hooks), see `docs/git-hooks.md`.

### CLI Reference

Generate `--help` documentation:

```bash
pnpm run docs
```

### Exit Codes

- `0` No secrets found
- `1` Secrets detected
- `2` Invalid usage or configuration

## Configuration

Env Secret Guard works out of the box by reading `.env` and `.env.*` in the repo root (excluding `.env.example`). This mirrors how most projects already store secrets and avoids keeping an explicit list of secret files.

If you need custom behavior, add a config file in the repo root:

`secret-scan.config.json` or `.secret-scan.json`

Example:

```json
{
  "envFileGlobs": [".env", ".env.*"],
  "envFileExcludes": [".env.example"],
  "ignoreFileGlobs": [
    "**/node_modules/**",
    "**/.git/**",
    "**/.next/**",
    "**/dist/**",
    "**/build/**",
    "**/coverage/**",
    "**/.turbo/**",
    "**/*.log",
    "**/pnpm-lock.yaml"
  ],
  "allowFileGlobs": ["**/__tests__/**"],
  "minSecretLength": 10,
  "commonValues": ["true", "false", "localhost"],
  "binaryExtensions": [".png", ".jpg"]
}
```

`allowFileGlobs` is a list of paths that are permitted to contain secrets (for example, fixtures). Matching files are skipped.

You can also point to a specific config file:

```bash
secret-scan --config path/to/config.json scan --staged
```

Or via environment variable:

```bash
SECRET_SCAN_CONFIG=path/to/config.json secret-scan scan --staged
```

## Output Modes

- Default: human-readable summary
- `--plain`: one line per finding (`path<TAB>ENV_KEY<TAB>ENV_FILE`). For `--history` or `--all`, `path` is prefixed with `staged:`, `working-tree:`, or `history:<short-sha>:`.
- `--json`: structured output for scripts

## How It Works

1. Read `.env` files to collect values.
2. Filter out common placeholders and short values.
3. Scan files for exact matches of the remaining values.
4. Report matches and exit non-zero to block commits/CI.

## Development

```bash
pnpm install
pnpm test
pnpm build
```

## License

MIT
