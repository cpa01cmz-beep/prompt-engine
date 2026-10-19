import { Hono } from "hono";
import type { Env } from "../env";
import { chatCompletion } from "../services/ai";
import type { AiMessage } from "@shared/types";

const app = new Hono<{ Bindings: Env }>();

app.post("/chat", async (c) => {
  const body = (await c.req.json()) as { messages: AiMessage[] };
  const content = await chatCompletion(c.env, body.messages);
  return c.json({ ok: true, data: { content } });
});

app.post("/generate-prompt", async (c) => {
  const body = (await c.req.json()) as { goal: string };
  const messages: AiMessage[] = [
    { role: "system", content: "You are an expert prompt engineer. Generate a high-quality prompt for the user's goal. Return only the prompt text." },
    { role: "user", content: body.goal },
  ];
  const content = await chatCompletion(c.env, messages);
  return c.json({ ok: true, data: { content } });
});

app.post("/evaluate-prompt", async (c) => {
  const body = (await c.req.json()) as { prompt: string };
  const messages: AiMessage[] = [
    { role: "system", content: "Evaluate the prompt quality. Return JSON with score (0-100) and feedback array." },
    { role: "user", content: body.prompt },
  ];
  const content = await chatCompletion(c.env, messages);
  return c.json({ ok: true, data: { content } });
});

app.post("/optimize-prompt", async (c) => {
  const body = (await c.req.json()) as { prompt: string };
  const messages: AiMessage[] = [
    { role: "system", content: "Rewrite the prompt to improve quality. Return only the improved prompt." },
    { role: "user", content: body.prompt },
  ];
  const content = await chatCompletion(c.env, messages);
  return c.json({ ok: true, data: { content } });
});

app.post("/generate-skill", async (c) => {
  const body = (await c.req.json()) as { goal: string };
  const messages: AiMessage[] = [
    { role: "system", content: "Create a skill definition (name, description, instructions) for the goal. Return JSON." },
    { role: "user", content: body.goal },
  ];
  const content = await chatCompletion(c.env, messages);
  return c.json({ ok: true, data: { content } });
});

app.post("/evaluate-skill", async (c) => {
  const body = (await c.req.json()) as { skill: string };
  const messages: AiMessage[] = [
    { role: "system", content: "Evaluate the skill definition. Return JSON with score (0-100) and feedback array." },
    { role: "user", content: body.skill },
  ];
  const content = await chatCompletion(c.env, messages);
  return c.json({ ok: true, data: { content } });
});

app.post("/optimize-skill", async (c) => {
  const body = (await c.req.json()) as { skill: string };
  const messages: AiMessage[] = [
    { role: "system", content: "Improve the skill definition. Return JSON." },
    { role: "user", content: body.skill },
  ];
  const content = await chatCompletion(c.env, messages);
  return c.json({ ok: true, data: { content } });
});

export default app;
