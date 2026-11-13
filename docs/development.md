# Development setup

## Prerequisites

- Node ≥ 22 (CI and the Android build use Node 22)
- pnpm 10 (`corepack enable` then `corepack use pnpm@10`)

## Install & test

```bash
pnpm install
pnpm test        # packages and workers (apps/mobile has no test script)
pnpm typecheck   # tsc across every workspace package
bash scripts/verify.sh   # apps/mobile: tsc + tests; run before each commit
```

CI runs all three (`.github/workflows/ci.yml`).

Run a single package's tests directly — no build, no test framework, just
Node's built-in runner and type-stripping:

```bash
cd packages/pos-core && node --test
```

## Why there's no build step (yet)

The core packages export their `.ts` sources directly and are consumed two
ways, both of which compile on the fly:

- **Node** (tests, tooling) strips types natively — that is why relative
  imports use explicit `.ts` extensions.
- **Metro** (the Expo app) transpiles TypeScript already.

A `tsc`/`tsup` build is only added when we publish packages to npm, which we
don't for an app-internal monorepo. Add it then, not now.

## Conventions

- Strict TypeScript, no `any`, small pure functions, explicit error handling.
- Business logic lives in domain packages, never in UI components.
- Every business-critical change ships with a runnable test.
- Money never touches a float — use `pos-core` helpers.
- New DB schema = new migration file; never edit an applied one.

## Layout for a new vertical slice

```
packages/<domain>/src/...      # pure domain logic + tests
apps/mobile/src/*Ops.ts        # orchestration: transactions, with the db injected
apps/mobile/src/repos.ts       # SQL queries
apps/mobile/src/pos/...        # POS components
apps/mobile/app/...            # Expo Router screens
```
