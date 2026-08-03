import { describe, it, expect } from "vitest";
import { cosine } from "./embed.js";

describe("cosine similarity", () => {
  it("is 1 for identical vectors", () => {
    expect(cosine([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 5);
  });

  it("is 0 for orthogonal vectors", () => {
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0, 5);
  });

  it("ranks a closer vector higher", () => {
    const q = [1, 1];
    const close = cosine(q, [1, 1]);
    const far = cosine(q, [1, 0]);
    expect(close).toBeGreaterThan(far);
  });

  it("returns 0 for zero vectors (no div-by-zero)", () => {
    expect(cosine([0, 0], [1, 2])).toBe(0);
  });
});
