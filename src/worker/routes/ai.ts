import { Hono } from "hono";
import type { Env } from "../env";
import { chatCompletion } from "../services/ai";
import type { AiMessage } from "@shared/types";
import { isNonEmptyString, parseJsonBody } from "../lib/validate";

const app = new Hono<{ Bindings: Env }>();

app.post("/chat", async (c) => {
  try {
    const body = await parseJsonBody<{ messages: AiMessage[] }>(c);
    if (!Array.isArray(body?.messages)) {
      return c.json({ ok: false, error: "Missing required field: messages" }, 400);
    }
    const content = await chatCompletion(c.env, body.messages);
    return c.json({ ok: true, data: { content } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ ok: false, error: message }, 500);
  }
});

app.post("/generate-prompt", async (c) => {
  try {
    const body = await parseJsonBody<{ goal: string }>(c);
    if (!isNonEmptyString(body?.goal)) {
      return c.json({ ok: false, error: "Missing required field: goal" }, 400);
    }
    const messages: AiMessage[] = [
      { role: "system", content: "You are an expert prompt engineer. Generate a high-quality prompt for the user's goal. Return only the prompt text." },
      { role: "user", content: body.goal },
    ];
    const content = await chatCompletion(c.env, messages);
    return c.json({ ok: true, data: { content } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ ok: false, error: message }, 500);
  }
});

app.post("/evaluate-prompt", async (c) => {
  try {
    const body = await parseJsonBody<{ prompt: string }>(c);
    if (!isNonEmptyString(body?.prompt)) {
      return c.json({ ok: false, error: "Missing required field: prompt" }, 400);
    }
    const messages: AiMessage[] = [
      { role: "system", content: "Evaluate the prompt quality. Return JSON with score (0-100) and feedback array." },
      { role: "user", content: body.prompt },
    ];
    const content = await chatCompletion(c.env, messages);
    return c.json({ ok: true, data: { content } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ ok: false, error: message }, 500);
  }
});

app.post("/optimize-prompt", async (c) => {
  try {
    const body = await parseJsonBody<{ prompt: string }>(c);
    if (!isNonEmptyString(body?.prompt)) {
      return c.json({ ok: false, error: "Missing required field: prompt" }, 400);
    }
    const messages: AiMessage[] = [
      { role: "system", content: "Rewrite the prompt to improve quality. Return only the improved prompt." },
      { role: "user", content: body.prompt },
    ];
    const content = await chatCompletion(c.env, messages);
    return c.json({ ok: true, data: { content } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ ok: false, error: message }, 500);
  }
});

app.post("/generate-skill", async (c) => {
  try {
    const body = await parseJsonBody<{ goal: string }>(c);
    if (!isNonEmptyString(body?.goal)) {
      return c.json({ ok: false, error: "Missing required field: goal" }, 400);
    }
    const messages: AiMessage[] = [
      { role: "system", content: "Create a skill definition (name, description, instructions) for the goal. Return JSON." },
      { role: "user", content: body.goal },
    ];
    const content = await chatCompletion(c.env, messages);
    return c.json({ ok: true, data: { content } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ ok: false, error: message }, 500);
  }
});

app.post("/evaluate-skill", async (c) => {
  try {
    const body = await parseJsonBody<{ skill: string }>(c);
    if (!isNonEmptyString(body?.skill)) {
      return c.json({ ok: false, error: "Missing required field: skill" }, 400);
    }
    const messages: AiMessage[] = [
      { role: "system", content: "Evaluate the skill definition. Return JSON with score (0-100) and feedback array." },
      { role: "user", content: body.skill },
    ];
    const content = await chatCompletion(c.env, messages);
    return c.json({ ok: true, data: { content } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ ok: false, error: message }, 500);
  }
});

app.post("/optimize-skill", async (c) => {
  try {
    const body = await parseJsonBody<{ skill: string }>(c);
    if (!isNonEmptyString(body?.skill)) {
      return c.json({ ok: false, error: "Missing required field: skill" }, 400);
    }
    const messages: AiMessage[] = [
      { role: "system", content: "Improve the skill definition. Return JSON." },
      { role: "user", content: body.skill },
    ];
    const content = await chatCompletion(c.env, messages);
    return c.json({ ok: true, data: { content } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ ok: false, error: message }, 500);
  }
});

export default app;
