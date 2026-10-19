# Quality Gates

- lint: pass
- typecheck: pass
- test:unit: pass (11 tests)
- test:integration: pass (2 tests)
- build: pass

## Accessibility (axe WCAG A/AA) — 2026-10-19

- `npx playwright test --project=chromium --workers=1 --reporter=line tests/e2e/a11y.spec.ts`: pass (7/7 — automatic screen scanner; manual assistive-technology testing not performed in this run, axe Web Accessibility Testing not exhaustive)
- `color-contrast` on `.text-indigo-600/80` (active nav module description, `src/client/App.tsx`): resolved by using fully opaque `text-indigo-600` (≈6.3:1 on white, ≥ 4.5:1 requirement for text-xs).
- `skill engine: Search screen` scan now executes (was previously skipped due to a sub-string role-name collision with the "Research" nav button; Playwright `getByRole` `name` matching made exact via `exact: true`). Scan passes with 0 WCAG A/AA violations.
- Skill Search page visible label "Query" is programmatically associated with the input (`htmlFor`/`id` via `react` `id` in `src/client/components/ui.tsx` `Input`).
