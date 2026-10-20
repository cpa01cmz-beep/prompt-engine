/**
 * Instrumented repro for the webkit PromptCreator slowness/instability.
 * Replicates flows.spec.ts happy path, then samples the Save button:
 *  - bounding rect over 30 rAF frames (is it "stable"?)
 *  - node identity churn (does react remount the button?)
 *  - visible/enabled state
 *  - rAF cadence (webkit throttling?)
 * Writes a compact JSON report to stdout.
 */
import { createRequire } from "node:module";
const require = createRequire("/workspaces/prompt-engine/");
const { webkit, chromium, firefox } = require("@playwright/test");

const ENGINE = process.env.ENGINE ?? "webkit";
const API = { webkit, chromium, firefox }[ENGINE];

async function main() {
  const browser = await API.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on("pageerror", (e) => console.error("PAGEERROR:", e.message));
  page.on("console", (m) => { if (m.type() === "error") console.error("CONSOLE:", m.text().slice(0, 200)); });
  await context.addInitScript(() => localStorage.setItem("auth.token", "e2e-probe-token"));
  const okEnv = (data) => ({ status: 200, body: { ok: true, data } });
  await page.route("**/api/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const key = req.method() + " " + url.pathname;
    const map = {
      "GET /api/auth/me": okEnv({ id: "u-e2e", username: "e2e-user", role: "admin" }),
      "POST /api/ai/generate-prompt": okEnv({ content: "Generated prompt content" }),
      "POST /api/prompts": okEnv({ id: "p-new", title: "Generated prompt", content: "Generated prompt content", version: 1 }),
    };
    const resp = map[key];
    if (resp) return route.fulfill({ status: resp.status, contentType: "application/json", body: JSON.stringify(resp.body) });
    console.error("UNMOCKED:", key);
    return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ ok: false, error: "Not found" }) });
  });

  const t0 = Date.now();
  await page.goto("http://localhost:5173/");
  try {
    await page.getByRole("heading", { name: "Prompt & Skills Engine" }).waitFor({ state: "visible", timeout: 30000 });
  } catch (e) {
    const con = [];
    page.on("console", (m) => con.push(m.type() + ": " + m.text()));
    console.error("SHELL TIMEOUT. url=", page.url());
    console.error("BODY SNIPPET:", (await page.locator("body").innerText({ timeout: 3000 })).slice(0, 300));
    console.error("CONSOLE:", con.join(" || ").slice(0, 300));
    await page.screenshot({ path: "/tmp/opencode/probe-fail.png", fullPage: false });
    throw e;
  }

  const t1 = Date.now();
  await page.getByLabel("Goal").fill("Write a launch email");
  const t2 = Date.now();
  await page.locator("section").getByRole("button", { name: "Generate" }).click();
  const t3 = Date.now();
  await expectResult(page);
  const t4 = Date.now();
  await page.locator("section").getByRole("button", { name: "Save" }).click();
  const t5 = Date.now();

  const probe = await page.evaluate(() =>
    new Promise((resolve) => {
      const find = () => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Save");
      const btn0 = find();
      if (btn0) btn0.__probeId = Math.random().toString(36).slice(2);
      const rects = [];
      const rafs = [];
      let n = 0;
      const start = performance.now();
      const step = () => {
        const btn = find();
        rafs.push(performance.now() - start);
        rects.push(
          btn
            ? (({ x, y, width, height }) => ({ x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000, w: Math.round(width * 1000) / 1000, h: Math.round(height * 1000) / 1000 }))(btn.getBoundingClientRect())
            : null,
        );
        if (++n < 40) requestAnimationFrame(step);
        else
          resolve({
            probeId: btn0 && btn0.__probeId,
            sameNode: !!(btn0 && find() && find().__probeId === btn0.__probeId),
            idCount: new Set([...document.querySelectorAll("button")].map((b) => b.__probeId || "")).size,
            rects,
            rafs,
            disabled: btn0 ? btn0.disabled : null,
            visibility: document.visibilityState,
            fonts: document.fonts.status,
            anim: [...document.getAnimations()].map((a) => ({ t: a.animationName || a.constructor.name, st: a.playState })).slice(0, 10),
          });
      };
      requestAnimationFrame(step);
    }),
  );

  // Deduplicate rects + rAF deltas
  const uniqRects = [...new Set(probe.rects.map((r) => JSON.stringify(r)))];
  const rafDeltas = probe.rafs.map((v, i) => (i ? Math.round((v - probe.rafs[i - 1]) * 100) / 100 : 0));

  const out = {
    engine: ENGINE,
    timingsMs: { goto: t1 - t0, fill: t2 - t1, generate: t3 - t2, expectResult: t4 - t3, save: t5 - t4 },
    uniqRectCount: uniqRects.length,
    uniqRects: uniqRects.slice(0, 6),
    rafCount: probe.rafs.length,
    rafSpanMs: Math.round((probe.rafs[probe.rafs.length - 1] ?? 0) * 10) / 10,
    rafDeltaMax: Math.max(...rafDeltas),
    rafDeltaMin: Math.min(...rafDeltas.slice(1)),
    sameNode: probe.sameNode,
    disabled: probe.disabled,
    visibility: probe.visibility,
    fonts: probe.fonts,
    runningAnimations: probe.anim,
  };
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
}

async function expectResult(page) {
  const expect = require("@playwright/test").expect;
  await expect(page.getByLabel("Result")).toHaveValue("Generated prompt content");
}

main().catch((e) => {
  console.error("FAILED:", String(e).slice(0, 400));
  process.exit(1);
});
