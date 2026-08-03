import { describe, it, expect } from "vitest";
import { isPrivateIp, safeJoin } from "./sandbox.js";

describe("isPrivateIp (SSRF guard)", () => {
  const blocked = [
    "127.0.0.1",
    "169.254.169.254", // cloud metadata
    "10.0.0.5",
    "192.168.1.1",
    "172.16.0.1",
    "172.31.255.255",
    "0.0.0.0",
    "100.64.0.1", // CGNAT
    "224.0.0.1", // multicast
    "::1", // ipv6 loopback
  ];
  const allowed = ["8.8.8.8", "93.184.216.34", "1.1.1.1", "104.16.123.96"];

  for (const ip of blocked) {
    it(`blocks ${ip}`, () => expect(isPrivateIp(ip)).toBe(true));
  }
  for (const ip of allowed) {
    it(`allows ${ip}`, () => expect(isPrivateIp(ip)).toBe(false));
  }
  // 172.32.x is PUBLIC (outside 172.16/12)
  it("treats 172.32.0.1 as public (outside 172.16/12)", () => {
    expect(isPrivateIp("172.32.0.1")).toBe(false);
  });
});

describe("safeJoin (path traversal guard)", () => {
  const root = "/tmp/ws";

  it("accepts a simple relative path", () => {
    expect(safeJoin(root, "hello.txt")).toBe("/tmp/ws/hello.txt");
  });

  it("normalizes internal .. that stay within root", () => {
    expect(safeJoin(root, "sub/../hello.txt")).toBe("/tmp/ws/hello.txt");
  });

  it("accepts nested dirs", () => {
    expect(safeJoin(root, "a/b/c")).toBe("/tmp/ws/a/b/c");
  });

  it("BLOCKS ../../etc/passwd", () => {
    expect(() => safeJoin(root, "../../etc/passwd")).toThrow(/escapes workspace root/);
  });

  it("BLOCKS Windows-style ..\\..\\ traversal", () => {
    expect(() => safeJoin(root, "..\\..\\win")).toThrow(/escapes workspace root/);
  });

  it("anchors an absolute path to the root (treats as relative)", () => {
    expect(safeJoin(root, "/etc/passwd")).toBe("/tmp/ws/etc/passwd");
  });
});
