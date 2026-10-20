# Gate 3 re-verification — failing results recorded verbatim

Full-suite logs: `docs/evidence/iter2-reverify-e2e.log` (run 1), `docs/evidence/iter2-reverify-e2e-run2.log` (run 2).
In-suite traces were wiped by subsequent `playwright test` invocations (Playwright clears `outputDir` at startup);
a saturated-PPC reproduction trace with the identical signature is preserved under `repro-saturated-cpu/`.

## Run 1 (0700-0709 UTC) — webkit click stability timeout
✘ test: `[webkit] › tests/e2e/flows.spec.ts:5:3 › prompt engine form flow (Creator) › generate -> save shows success states and API errors surface`

```
TimeoutError: locator.click: Timeout 15000ms exceeded.
Call log:
  - waiting for locator('section').getByRole('button', { name: 'Save' })
    - locator resolved to <button type="button" class="inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 px-4 py-2">Save</button>
  - attempting click action
    - waiting for element to be visible, enabled and stable

    34 |       body: { ok: false, error: "Could not save prompt" },
    35 |     });
  > 36 |     await panel.getByRole("button", { name: "Save" }).click();
      |                                                      ^
    37 |     await expect(page.getByText("Could not save prompt")).toBeVisible();

    at /workspaces/prompt-engine/tests/e2e/flows.spec.ts:36:55
```

## Run 2 (~0711 UTC) — same signature, two more webkit tests
✘ 1) `[webkit] › tests/e2e/flows.spec.ts:54:3 › … › context fields reach /api/ai/generate-prompt and empty fields are omitted`

```
TimeoutError: locator.click: Timeout 15000ms exceeded.
Call log:
  - waiting for locator('section').getByRole('button', { name: 'Generate' })
  - locator resolved to <button type="button" …>Generate</button>
  - attempting click action
    - waiting for element to be visible, enabled and stable
    70 |     await panel.getByRole("button", { name: "Generate" }).click();
    at /workspaces/prompt-engine/tests/e2e/flows.spec.ts:70:59
```

✘ 2) `[webkit] › tests/e2e/iter2-console.spec.ts:12:3 › console hygiene › primary journey emits no pageerror or console error`

```
TimeoutError: locator.click: Timeout 15000ms exceeded.
Call log:
  - waiting for locator('section').getByRole('button', { name: 'Generate' })
  - attempting click action
    - waiting for element to be visible, enabled and stable
    42 |     await panel.getByRole("button", { name: "Generate" }).click();
    at /workspaces/prompt-engine/tests/e2e/iter2-console.spec.ts:42:59
```
