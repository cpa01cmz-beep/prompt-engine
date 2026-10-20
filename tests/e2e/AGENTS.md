# AGENTS.md — tests/e2e

## Scope
Playwright (chromium/firefox/webkit projects). Specs: `home.spec.ts`, `modules.spec.ts`, `flows.spec.ts` (end-to-end flows incl. AI error surfacing), `search-library.spec.ts`, `a11y.spec.ts` (axe-core), `iter2-console.spec.ts` (console noise guard). Shared helpers in `fixtures.ts` / `helpers.ts`.

## Rules
- The config boots `npm run dev` on :5173 via `webServer` (reuses an existing server locally) — so apply local D1 migrations before the first run or flows hit "no such table".
- `workers: 1` is intentional (WebKit stalls under parallel load on small runners) — don't raise it; traces are retained on failure, videos stay off.
- Requires `npx playwright install --with-deps`.

## Verification
`npm run test:e2e`; single spec: `npx playwright test e2e/flows.spec.ts`. HTML report → `playwright-report/`.
