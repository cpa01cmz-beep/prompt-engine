import { describe, it, expect } from "vitest";
import {
  PromptInputSchema,
  TemplateInputSchema,
  SkillInputSchema,
  EvaluationInputSchema,
  GeneratePromptSchema,
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

  it("validates generate-prompt input with goal only", () => {
    const ok = GeneratePromptSchema.safeParse({ goal: "write a summary" });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.role).toBeUndefined();
  });

  it("rejects empty goal (min(1) bound)", () => {
    expect(GeneratePromptSchema.safeParse({ goal: "" }).success).toBe(false);
  });

  it("accepts goals of any positive length up to MAX_TEXT", () => {
    // Spec uses BoundedText.min(1): only empty strings are rejected.
    expect(GeneratePromptSchema.safeParse({ goal: "   " }).success).toBe(true);
  });

  it("rejects context fields exceeding text bounds", () => {
    const long = "x".repeat(20_001);
    expect(GeneratePromptSchema.safeParse({ goal: "g", role: long }).success).toBe(false);
    expect(GeneratePromptSchema.safeParse({ goal: long }).success).toBe(false);
  });

  it("accepts every optional context field", () => {
    const ok = GeneratePromptSchema.safeParse({
      goal: "g",
      role: "reviewer",
      variables: ["topic", "tone"],
      constraints: "under 100 words",
      examples: "Sample",
    });
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data).toEqual({
        goal: "g",
        role: "reviewer",
        variables: ["topic", "tone"],
        constraints: "under 100 words",
        examples: "Sample",
      });
    }
  });

  it("rejects variables with more than 50 items", () => {
    const vars = Array.from({ length: 51 }, (_, i) => `v${i}`);
    expect(GeneratePromptSchema.safeParse({ goal: "g", variables: vars }).success).toBe(false);
    const fifty = vars.slice(0, 50);
    expect(GeneratePromptSchema.safeParse({ goal: "g", variables: fifty }).success).toBe(true);
  });

  it("rejects empty-string variable entries", () => {
    expect(GeneratePromptSchema.safeParse({ goal: "g", variables: ["a", ""] }).success).toBe(false);
  });
});
