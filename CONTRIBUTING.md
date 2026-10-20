# Contributing

Thanks for wanting to contribute. This repo is small and single-maintainer for now, so the bar is: small, tested, evidenced changes.

## Branch & merge policy

- `main` is protected: no force pushes, no deletions, required CI status checks before merge.
- Prefer small PRs even for solo work — CI runs on PRs, and the review/approval overhead is zero when you're the only reviewer.

## Commit style

Use imperative, conventional-commit-like prefixes as used in history:

```
fix(scope): …      feat(scope): …     chore: …
```

## Conventions (enforced locally, checked in CI)

1. **AGENTS.md is law** — every folder carries one; read it before editing files there. If you add a folder, add its AGENTS.md too.
2. **TypeScript strict mode**; shared worker code lives in `src/worker/lib` with unit coverage.
3. **No secrets in logs or responses.** Never surface upstream/API error bodies to clients — use the shared `mapOutboundError` helper in catch blocks. See `tests/unit/outboundError.test.ts` for the contract.
4. **Keep functions small** with tests (`tests/unit`, `tests/integration`, `tests/e2e`).

## Quality gates before you push

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
```

E2E (`npm run test:e2e`) needs Playwright browsers: `npx playwright install --with-deps`.

## Evidence

Quality-gate evidence (audit notes, command output summaries, screenshots) goes under `docs/evidence/` — one dated file per event, e.g. `docs/evidence/2026-10-20-repo-audit.md`.

## Reporting issues

Use the bug report / feature request templates under `.github/ISSUE_TEMPLATE/`. For security issues, do **not** open a public issue — see [SECURITY.md](SECURITY.md).
