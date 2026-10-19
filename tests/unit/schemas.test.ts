import { describe, it, expect } from "vitest";
import {
  PromptInputSchema,
  TemplateInputSchema,
  SkillInputSchema,
  EvaluationInputSchema,
} from "../../src/worker/schemas";

describe("schemas", () => {
  it("validates prompt input", () => {
    const ok = PromptInputSchema.safeParse({ title: "t", content: "c" });
    expect(ok.success).toBe(true);
    const bad = PromptInputSchema.safeParse({ title: "", content: "c" });
    expect(bad.success).toBe(false);
  });

  it("validates template input", () => {
    const ok = TemplateInputSchema.safeParse({ name: "n", body: "b" });
    expect(ok.success).toBe(true);
    const bad = TemplateInputSchema.safeParse({ name: "n" });
    expect(bad.success).toBe(false);
  });

  it("validates skill input", () => {
    const ok = SkillInputSchema.safeParse({ name: "s" });
    expect(ok.success).toBe(true);
    const bad = SkillInputSchema.safeParse({});
    expect(bad.success).toBe(false);
  });

  it("validates evaluation input", () => {
    const ok = EvaluationInputSchema.safeParse({ targetType: "prompt", targetId: "1" });
    expect(ok.success).toBe(true);
    const bad = EvaluationInputSchema.safeParse({ targetType: "x", targetId: "1" });
    expect(bad.success).toBe(false);
  });
});
