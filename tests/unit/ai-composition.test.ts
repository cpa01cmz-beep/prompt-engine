import { describe, it, expect } from "vitest";
import { buildCreatePromptMessages } from "../../src/worker/services/ai";

const GENERATE_ENDPOINT_MESSAGES_LENGTH = 2;

function userContent(goal: string, ctx?: Parameters<typeof buildCreatePromptMessages>[1]): string {
  const messages = buildCreatePromptMessages(goal, ctx);
  expect(messages).toHaveLength(2);
  expect(messages[0]?.role).toBe("system");
  expect(messages[1]?.role).toBe("user");
  return messages[1]?.content ?? "";
}

describe("buildCreatePromptMessages composition", () => {
  it("returns goal-only user message when no context is given", () => {
    const messages = buildCreatePromptMessages("write a haiku");
    expect(userContent("write a haiku")).toBe("write a haiku");
    expect(messages).toHaveLength(GENERATE_ENDPOINT_MESSAGES_LENGTH);
  });

  it("returns goal-only user message for an all-empty context", () => {
    expect(
      userContent("write a haiku", { role: "", variables: [], constraints: "", examples: "" }),
    ).toBe("write a haiku");
  });

  it("appends labeled sections in deterministic order", () => {
    const content = userContent("write a haiku", {
      role: "editor",
      variables: ["topic", "mood"],
      constraints: "under 100 words",
      examples: "Sample line one",
    });
    expect(content).toBe(
      "write a haiku\nRole: editor\nVariables: topic, mood\nConstraints: under 100 words\nExamples: Sample line one",
    );
  });

  it("comma-joins variables", () => {
    const content = userContent("g", { variables: ["a", "b", "c"] });
    expect(content).toBe("g\nVariables: a, b, c");
    expect(content).not.toContain("Role:");
  });

  it("omits individual empty fields while keeping provided ones", () => {
    const content = userContent("g", { role: "reviewer", constraints: "" });
    expect(content).toBe("g\nRole: reviewer");
    expect(content).not.toContain("Constraints:");
  });

  it("keeps the same two-message shape as the goal-only call", () => {
    const goalOnly = buildCreatePromptMessages("g");
    const withCtx = buildCreatePromptMessages("g", { role: "r" });
    expect(withCtx).toHaveLength(goalOnly.length);
    expect(withCtx[0]).toEqual(goalOnly[0]);
  });

  it("returns the same user content for undefined context as for goal alone", () => {
    expect(buildCreatePromptMessages("goal text")).toEqual(
      buildCreatePromptMessages("goal text", undefined),
    );
  });
});
