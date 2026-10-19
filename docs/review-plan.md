# Review and Quality Gate Strategy

## Gates
1. Build: `npm run build` exits 0.
2. Lint: `npm run lint` exits 0.
3. Typecheck: `npm run typecheck` exits 0.
4. Static analysis: ESLint security rules + `npm audit` no high/critical.
5. Unit: `npm run test:unit` passes; coverage >= 70% statements.
6. Integration: `npm run test:integration` passes against local Worker.
7. E2E: `npm run test:e2e` passes Chromium/Firefox/WebKit.
8. Security: security tests + dependency audit pass.
9. Accessibility: axe checks no serious/critical violations.
10. Performance: Lighthouse or bundle budget thresholds.
11. Compatibility: multi-browser and mobile viewport E2E pass.

## Evidence
All raw command output stored in `docs/evidence/` with timestamps and environment details.
