/**
 * Sandboxing primitives for server-side tools.
 *
 * These are the load-bearing security helpers every tool must use:
 *   - assertPublicUrl / assertPrivateIp : block SSRF (model can't reach
 *     localhost, cloud metadata 169.254.169.254, private ranges, etc.)
 *   - safeJoin : block path traversal outside an allowed root
 *   - sanitizedEnv : strip API keys / secrets before spawning subprocesses
 */
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { isAbsolute, join, normalize, resolve } from "node:path";

/* ---------------------------- SSRF protection ---------------------------- */

/** True for IPv4/IPv6 that must never be fetched by tools. */
export function isPrivateIp(ip: string): boolean {
  // IPv6 loopback / unspecified
  if (ip === "::1" || ip === "::" || ip === "0:0:0:0:0:0:0:1") return true;
  // IPv4-mapped IPv6
  const v4 = ip.includes(":") && ip.includes(".") ? ip.split(":").pop()! : ip;
  if (!isIP(v4)) return false;
  const parts = v4.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255))
    return false;
  const [a, b] = parts;
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local + cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a >= 224) return true; // multicast / reserved
  return false;
}

/** Hostnames that must never be resolved/fetched. */
const BLOCKED_HOSTS = new Set([
  "localhost",
  "ip6-localhost",
  "ip6-loopback",
  "metadata.google.internal", // GCP metadata
]);

const ALLOWED_URL_SCHEMES = new Set(["http:", "https:"]);

export interface AssertUrlOptions {
  /** Allow the proxy's own configured providers (e.g. for health checks). */
  allowPrivate?: boolean;
}

/**
 * Validate a URL is safe to fetch. Resolves DNS and rejects private/loopback/
 * link-local/metadata destinations. Throws on violation.
 */
export async function assertPublicUrl(
  rawUrl: string,
  opts: AssertUrlOptions = {},
): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid URL: ${rawUrl}`);
  }
  if (!ALLOWED_URL_SCHEMES.has(url.protocol)) {
    throw new Error(`Blocked URL scheme: ${url.protocol}`);
  }
  if (opts.allowPrivate) return url;

  const host = url.hostname.toLowerCase().replace(/^\[|]$/g, "");
  if (BLOCKED_HOSTS.has(host)) throw new Error(`Blocked host: ${host}`);

  // If it's already an IP literal, check directly.
  if (isIP(host)) {
    if (isPrivateIp(host)) throw new Error(`Refusing private/reserved IP: ${host}`);
    return url;
  }

  // Otherwise resolve and reject if any A record is private.
  try {
    const records = await lookup(host, { all: true });
    for (const r of records) {
      if (isPrivateIp(r.address)) {
        throw new Error(`Host ${host} resolves to private IP ${r.address}`);
      }
    }
  } catch (err) {
    if ((err as Error).message.startsWith("Host ")) throw err;
    throw new Error(`Could not resolve host: ${host}`);
  }
  return url;
}

/* -------------------------- Path traversal guard ------------------------- */

/**
 * Join `root` with `untrustedPath` and verify the result stays inside `root`.
 * Returns the absolute, normalized path. Throws on escape attempts.
 */
export function safeJoin(root: string, untrustedPath: string): string {
  const rootAbs = resolve(root);
  // Normalize and strip leading slashes so users can't anchor to filesystem root.
  const cleaned = normalize("/" + untrustedPath.replace(/^[/\\]+/, "")).replace(
    /^([a-zA-Z]:)/,
    "",
  );
  const target = isAbsolute(cleaned) ? cleaned : join(rootAbs, cleaned);
  const rel = normalize(target);
  if (rel !== rootAbs && !rel.startsWith(rootAbs + require("node:path").sep)) {
    throw new Error(`Path escapes workspace root: ${untrustedPath}`);
  }
  return rel;
}

/* ----------------------------- Env sanitizing ---------------------------- */

const SECRET_HINTS = [
  "KEY",
  "TOKEN",
  "SECRET",
  "PASSWORD",
  "PASSWD",
  "CREDENTIAL",
  "AUTH",
];

/**
 * Produce an env object safe to pass to spawned tool processes. Keeps a small
 * allowlist of benign vars; drops anything that smells like a secret.
 */
export function sanitizedEnv(): NodeJS.ProcessEnv {
  const safe: NodeJS.ProcessEnv = {};
  const allow = new Set(["PATH", "HOME", "USER", "LANG", "LC_ALL", "SHELL", "SYSTEMROOT", "TEMP", "TMP"]);
  for (const [k, v] of Object.entries(process.env)) {
    if (v === undefined) continue;
    if (allow.has(k)) {
      safe[k] = v;
      continue;
    }
    if (SECRET_HINTS.some((h) => k.toUpperCase().includes(h))) continue; // drop secrets
    // keep other innocuous vars
    safe[k] = v;
  }
  return safe;
}
