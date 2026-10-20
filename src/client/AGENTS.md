# AGENTS.md — src/client

## Scope
React/Vite frontend. `main.tsx` mounts `App.tsx` (default export, engine toggle + grouped nav, auth gate). All 14 feature modules are imported directly in `App.tsx` from `./modules/*` — `pages/` is an unused empty placeholder.

## Rules
- Secrets and provider keys never appear here; AI runs via Worker REST `/api` through `lib/api.ts` (`api` wrapper injects the Bearer session token, unwraps `ApiResponse<T>`).
- Token handling goes through `lib/auth.ts` (`getToken` / `setToken` / `clearToken`) — no ad-hoc localStorage elsewhere.
- Build UI from the shared primitives in `components/ui.tsx`; Tailwind + `index.css`.
- New module: create `modules/X.tsx`, register it in `App.tsx`, add e2e coverage in `tests/e2e`.

## Verification
`npm run build` (Vite → `dist/client`) and `npm run test:e2e` for flows.
