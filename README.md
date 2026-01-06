# Secret Scanner

Secret Scanner prevents accidental commits of secrets by scanning files for exact values found in your `.env` files. It is designed for use in Git hooks and CI, and intentionally keeps the detection model simple, fast, and explainable.

## Features

- Uses `.env` values as the source of truth (no regex guesswork).
- Scans staged files for safe pre-commit protection.
- Optional full-repo scans for CI.
- Human-friendly output plus `--plain` and `--json` modes.

## Install

```bash
pnpm add -D secret-scanner
```

Or run once without installing:

```bash
pnpm dlx secret-scanner scan --staged
```

## Usage

```bash
secret-scanner scan --staged
secret-scanner scan --all
secret-scanner scan --all --include-untracked
secret-scanner scan --paths src apps/api
```

### Redaction

Redaction replaces exact secret values with a safe placeholder. Dry-run is the default; use `--apply` to write changes.

```bash
secret-scanner redact --all --dry-run
secret-scanner redact --all --apply
secret-scanner redact --paths src apps/api --dry-run
```

Redaction does not rewrite git history. If secrets were committed previously, rotate them and clean history separately.

### Git Hook (Husky)

```bash
pnpm exec secret-scanner scan --staged
```

### Exit Codes

- `0` No secrets found
- `1` Secrets detected
- `2` Invalid usage or configuration

## Configuration

Secret Scanner works out of the box by reading `.env` and `.env.*` in the repo root (excluding `.env.example`). This mirrors how most projects already store secrets and avoids keeping an explicit list of secret files.

If you need custom behavior, add a config file in the repo root:

`secret-scanner.config.json` or `.secret-scanner.json`

Example:

```json
{
  "envFileGlobs": [".env", ".env.*"],
  "envFileExcludes": [".env.example"],
  "ignoreFileGlobs": ["**/node_modules/**", "**/.git/**"],
  "allowFileGlobs": ["**/__tests__/**"],
  "minSecretLength": 10,
  "commonValues": ["true", "false", "localhost"],
  "binaryExtensions": [".png", ".jpg"]
}
```

`allowFileGlobs` is a list of paths that are permitted to contain secrets (for example, fixtures). Matching files are skipped.

You can also point to a specific config file:

```bash
secret-scanner --config path/to/config.json scan --staged
```

Or via environment variable:

```bash
SECRET_SCANNER_CONFIG=path/to/config.json secret-scanner scan --staged
```

## Output Modes

- Default: human-readable summary
- `--plain`: one line per finding (`path<TAB>ENV_KEY<TAB>ENV_FILE`)
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
