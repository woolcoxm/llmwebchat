import { describe, it, expect } from "vitest";
import { wordDiff } from "./diff.js";

describe("wordDiff", () => {
  it("marks everything same for identical text", () => {
    const { left, right } = wordDiff("hello world", "hello world");
    expect(left.every((p) => p.type === "same")).toBe(true);
    expect(right.every((p) => p.type === "same")).toBe(true);
  });

  it("flags an added word on the right column", () => {
    const { left, right } = wordDiff("hello world", "hello brave world");
    expect(left.some((p) => p.type === "del")).toBe(false);
    expect(right.some((p) => p.type === "add")).toBe(true);
    expect(right.find((p) => p.type === "add")?.text.trim()).toBe("brave");
  });

  it("flags a removed word on the left column", () => {
    const { left } = wordDiff("hello brave world", "hello world");
    expect(left.some((p) => p.type === "del")).toBe(true);
    expect(left.find((p) => p.type === "del")?.text.trim()).toBe("brave");
  });

  it("preserves shared words as same on both sides", () => {
    const { left, right } = wordDiff("the quick fox", "the slow fox");
    const leftSame = left.filter((p) => p.type === "same").map((p) => p.text.trim()).filter(Boolean);
    expect(leftSame).toContain("the");
    expect(leftSame).toContain("fox");
    const rightSame = right.filter((p) => p.type === "same").map((p) => p.text.trim()).filter(Boolean);
    expect(rightSame).toContain("fox");
  });
});
