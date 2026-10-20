# AGENTS.md — .github

## Scope
Repository policy files: `workflows/ci.yml` (gates job: lint → typecheck → build → unit → integration; e2e job: local D1 migrations + Playwright ×3 browsers), `ISSUE_TEMPLATE/` (bug report + feature request YAML forms), `PULL_REQUEST_TEMPLATE.md`, `CODEOWNERS` (review routing).

## Conventions
- Workflow job names listed in branch protection must stay in sync with ci.yml job IDs (`gates`, `e2e`).
- Keep CI lean: no video recordings (traces carry failure evidence, see playwright.config.ts).
- Node version comes from `.nvmrc`; e2e job applies `wrangler d1 migrations apply DB --local` before running — keep that step when editing the workflow.
- Timing/concurrency: 15-min gates timeout, 30-min e2e timeout, auto-cancel superseded runs on same ref.
