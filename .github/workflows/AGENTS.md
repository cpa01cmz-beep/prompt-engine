# AGENTS.md — .github/workflows

## Scope
`ci.yml` — the only workflow. Single `gates` job (lint → typecheck → build → test:unit → test:integration) then separate `e2e` job (local D1 migration apply + Playwright across chromium/firefox/webkit).

## Rule
Branch protection references these job IDs by name (`gates`, `e2e`) — renaming a job without updating protection settings will silently break merge requirements. Run on push to `main` + all PRs; concurrency group auto-cancels superseded runs.
