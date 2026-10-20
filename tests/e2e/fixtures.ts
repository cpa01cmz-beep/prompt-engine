import { test as base, expect } from "@playwright/test";

/**
 * Auth is enforced client-side by the Login gate (App.tsx): a token in
 * localStorage["auth.token"] means the app calls GET /api/auth/me. Specs
 * run with both seeded so the app shell renders under API mocks, without
 * exercising the real (D1-backed) auth backend.
 */
const E2E_TOKEN = "e2e-probe-token";

export const test = base.extend({
  authSeed: [
    async ({ context }, use) => {
      await context.addInitScript(
        ([token]) => localStorage.setItem("auth.token", token as string),
        [E2E_TOKEN],
      );
      await use();
    },
    { auto: true },
  ],
});

export { expect };
