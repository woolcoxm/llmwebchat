/**
 * Web tools: web_search (DuckDuckGo, key-free) and web_reader (fetch + extract).
 * Both enforce SSRF protection via assertPublicUrl().
 */
import { assertPublicUrl } from "./sandbox.js";
import type { ToolDef } from "@llmwebchat/shared";

const UA =
  "Mozilla/5.0 (compatible; LLMWebChat/0.1; +https://github.com/woolcoxm/llmwebchat)";
const MAX_BYTES = 200_000; // cap fetched bodies

async function fetchText(url: URL, max = MAX_BYTES): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html,application/json,text/*,*/*;q=0.1" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url.toString()}`);
  const ct = res.headers.get("content-type") ?? "";
  const buf = await res.arrayBuffer();
  const text = new TextDecoder("utf-8", { fatal: false }).decode(buf.slice(0, max));
  return ct.includes("text/html") ? htmlToText(text) : text.trim();
}

/** Minimal, dependency-free HTML → text for LLM context. */
function htmlToText(html: string): string {
  const kill = (re: RegExp) => (html = html.replace(re, " "));
  kill(/<script[\s\S]*?<\/script>/gi);
  kill(/<style[\s\S]*?<\/style>/gi);
  kill(/<noscript[\s\S]*?<\/noscript>/gi);
  kill(/<!--[\s\S]*?-->/g);
  // turn block elements into newlines
  html = html.replace(/<\/(p|div|li|h[1-6]|tr|br|section|article|header|footer)>/gi, "\n");
  html = html.replace(/<br\s*\/?>/gi, "\n");
  html = html.replace(/<[^>]+>/g, "");
  return decodeEntities(html)
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

const ENT: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
 "&#39;": "'",
  "&nbsp;": " ",
  "&apos;": "'",
};
function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&[a-z]+;/gi, (e) => ENT[e.toLowerCase()] ?? e);
}

/* ------------------------------- web_reader ------------------------------ */

export const webReaderDef: ToolDef = {
  name: "web_reader",
  description:
    "Fetch a public https/http URL and return its text content (HTML is stripped to text, ~200KB cap). Use to read articles, docs, or API responses. Cannot reach private/localhost addresses.",
  parameters: {
    type: "object",
    properties: {
      url: { type: "string", description: "Absolute http(s) URL to read" },
    },
    required: ["url"],
    additionalProperties: false,
  },
};

export async function webReader(args: { url: string }): Promise<string> {
  const url = await assertPublicUrl(args.url);
  const text = await fetchText(url);
  return text.slice(0, MAX_BYTES) || "(empty body)";
}

/* ------------------------------- web_search ------------------------------ */

export const webSearchDef: ToolDef = {
  name: "web_search",
  description:
    "Search the web (DuckDuckGo) and return up to N results as title/url/snippet JSON. Use for current info, then web_reader for full pages.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search query" },
      num: { type: "integer", description: "Max results (default 6)", default: 6 },
    },
    required: ["query"],
    additionalProperties: false,
  },
};

interface Hit {
  title: string;
  url: string;
  snippet: string;
}

export async function webSearch(args: {
  query: string;
  num?: number;
}): Promise<string> {
  const q = String(args.query ?? "").trim();
  if (!q) return "Error: empty query";
  const limit = Math.min(Math.max(args.num ?? 6, 1), 15);
  const searchUrl = await assertPublicUrl("https://html.duckduckgo.com/html/");
  const res = await fetch(searchUrl, {
    method: "POST",
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ q, b: "", kl: "" }).toString(),
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`DuckDuckGo HTTP ${res.status}`);
  const html = await res.text();
  const hits: Hit[] = [];

  // DDG html results: <a class="result__a" href="...">title</a> + <a class="result__snippet">
  const linkRe = /<a[^>]+class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const snipRe = /<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
  const links = [...html.matchAll(linkRe)];
  const snips = [...html.matchAll(snipRe)];
  for (let i = 0; i < links.length && hits.length < limit; i++) {
    let href = links[i][1] ?? "";
    // DDG wraps links as /l/?uddg=<encoded>
    const m = /[?&]uddg=([^&]+)/.exec(href);
    if (m) href = decodeURIComponent(m[1]);
    if (!/^https?:\/\//.test(href)) continue;
    hits.push({
      title: decodeEntities(links[i][2]?.replace(/<[^>]+>/g, "").trim() || href),
      url: href,
      snippet: decodeEntities(snips[i]?.[1]?.replace(/<[^>]+>/g, "").trim() ?? ""),
    });
  }
  if (!hits.length) return `No results for: ${q}`;
  return JSON.stringify(hits, null, 2);
}
