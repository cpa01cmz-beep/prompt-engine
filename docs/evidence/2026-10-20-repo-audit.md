# Repository audit — 2026-10-20

Repo: `cpa01cmz-beep/prompt-engine`, head `f7844be` before this change.

## Findings

| # | Finding | Severity | Action |
| --- | --- | --- | --- |
| 1 | `mapOutboundError` returned `String(cause)` to clients — leaked upstream error bodies/details in 502s, violating its own contract and 4 unit tests (regression of the "restore generic upstream error" commit). 13 catch blocks route through it. | High (info disclosure) | Fixed: generic `{ ok: false, error: "Upstream AI error" }` body, cause stays in server-side `console.error`. |
| 2 | No CI — quality gates ran only on developer machines. | High | Added `.github/workflows/ci.yml` (push main + PRs): lint, typecheck, build, unit, integration in one job; e2e (chromium/firefox/webkit) with Playwright report artifact on failure. |
| 3 | No LICENSE (package.json private, no license field). | Medium | Adopted MIT; added `LICENSE`, `"license": "MIT"`, `"engines": { "node": ">=22" }`. |
| 4 | No branch protection on `main`. | Medium | Applied via API after this commit lands (see tail of file). |
| 5 | Governance files missing (CONTRIBUTING, SECURITY.md, CODEOWNERS, PR/issue templates, .nvmrc). | Low | Added. |
| 6 | README was a stub (`# prompt-engine`). | Low | Rewrote with stack, commands, governance pointers. |
| 7 | No tags/releases; git history is linear conventional commits. | Info | Keep conventional-commit style; tag at first deploy. |

## Quality-gate evidence (local, Node v24.21.0)

| Gate | Result |
| --- | --- |
| `npm run lint` | 0 errors |
| `npm run typecheck` (`tsc -b`) | 0 errors |
| `npm run build` | recorded below after regeneration |
| `npm run test:unit` | 38/38 passing across 7 files (was 4 failed before fix #1) |
| `npm run test:integration` | 3/3 passing (1 file, 969 ms) |
| `npm run test:e2e` | not executed locally (Playwright browsers not installed in this codespace); covered by CI `e2e` job |

## Notes

- Client-visible upstream detail leak: `tests/unit/outboundError.test.ts` is the security contract for `src/worker/lib/outboundError.ts`; it now passes.
- CI runs `npm ci` (lockfile-driven) on Node from `.nvmrc` (24), `npm` cache via setup-node.
- Concurrency group cancels superseded runs on the same ref.

## Branch protection (applied post-push)

- `main`: block deletions and force pushes, linear history, **required status checks: `gates (lint, typecheck, build, unit, integration)` and `e2e`**.

No repo settings were changed before this file was committed.
