import { describe, it, expect } from "vitest";
import { parseJsonFromText } from "../../src/worker/services/ai";

describe("parseJsonFromText", () => {
  it("parses plain json", () => {
    expect(parseJsonFromText('{"a":1}')).toEqual({ a: 1 });
  });

  it("strips markdown fences", () => {
    const text = "```json\n{\"b\":2}\n```";
    expect(parseJsonFromText(text)).toEqual({ b: 2 });
  });

  it("extracts json from surrounding text", () => {
    const text = "Here is result: {\"c\":3} thanks";
    expect(parseJsonFromText(text)).toEqual({ c: 3 });
  });
});
