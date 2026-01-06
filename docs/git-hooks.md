# Git Hook Setup

This guide shows two ways to run Secret Scanner before commits:

1. Shared hooks with Husky (recommended for teams)
2. Local-only hooks using `.git/hooks/pre-commit`

## Option 1: Husky (Recommended)

Husky keeps hooks in the repo so every developer gets the same checks.

### 1. Install Husky

```bash
pnpm add -D husky
pnpm exec husky init
```

This creates `.husky/` and a default `pre-commit` file.

### 2. Add Secret Scanner to pre-commit

```bash
pnpm exec husky set .husky/pre-commit "pnpm exec secret-scan scan --staged"
```

### 3. Optional: keep hooks fast

If you already run other checks, keep Secret Scanner near the top to fail fast:

```bash
pnpm exec husky set .husky/pre-commit "pnpm exec secret-scan scan --staged && pnpm lint && pnpm test"
```

### 4. Verify

```bash
git add .
secret-scan scan --staged
```

## Option 2: Plain Git Hooks (Local Only)

This approach only affects your machine and does not sync to teammates.

### 1. Create a pre-commit hook

```bash
cat <<'HOOK' > .git/hooks/pre-commit
#!/bin/sh
pnpm exec secret-scan scan --staged
HOOK
chmod +x .git/hooks/pre-commit
```

### 2. Verify

```bash
git add .
secret-scan scan --staged
```

## CI Usage (Optional)

To enforce on CI, run a full scan:

```bash
pnpm exec secret-scan scan --all --include-untracked
```

## Redaction (Optional)

Redaction is a manual action; it is not recommended in pre-commit hooks:

```bash
pnpm exec secret-scan redact --all --dry-run
pnpm exec secret-scan redact --all --apply
```
