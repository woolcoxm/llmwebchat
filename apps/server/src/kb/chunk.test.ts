import { describe, it, expect } from "vitest";
import { chunkText } from "./chunk.js";

describe("chunkText", () => {
  it("returns a single chunk for short text", () => {
    const out = chunkText("hello world");
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe("hello world");
  });

  it("splits long text into multiple overlapping chunks", () => {
    const out = chunkText("a".repeat(2500), 800, 120);
    expect(out.length).toBeGreaterThan(1);
    expect(out[0].text.length).toBeLessThanOrEqual(800);
  });

  it("indexes chunks sequentially", () => {
    const out = chunkText("x".repeat(2000), 500, 50);
    expect(out.map((c) => c.index)).toEqual(out.map((_, i) => i));
  });

  it("returns empty array for empty/whitespace-only text", () => {
    expect(chunkText("   ")).toHaveLength(0);
  });
});
