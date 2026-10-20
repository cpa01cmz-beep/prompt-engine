# AGENTS.md — tests

## Scope
Three test layers, one config each:
- `unit/` — vitest (`vitest.config.ts`): jsdom, globals, `setup.ts` loads jest-dom. Matches `src/**/*.test.*` and `tests/unit/**`.
- `integration/` — vitest (`vitest.integration.config.ts`): plain node env; runs the real Hono app **in-process** with a mock env — needs no live worker, D1, or KV.
- `e2e/` — Playwright (`playwright.config.ts`): 3 browser projects, `workers: 1` by design, `webServer` boots `npm run dev` on :5173 automatically.

## Rules
- CI gate order matters: unit → integration runs in the `gates` job; e2e is a separate job that applies local D1 migrations first.
- Unit: `npx vitest run tests/unit/<file>` for one file. E2E: `npx playwright test <spec>`; needs `npx playwright install --with-deps`.
- Keep this directory's coverage split intact: pure logic → `unit`, route wiring → `integration`, user flows → `e2e`.
