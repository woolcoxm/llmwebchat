/**
 * Embeddings via any OpenAI-compatible /embeddings endpoint (Ollama, etc.).
 */
import type { ProviderConfig } from "@llmwebchat/shared";

function headersFor(provider: ProviderConfig): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json", ...(provider.headers ?? {}) };
  if (provider.apiKey) {
    const authHeader = provider.authHeader ?? "Authorization";
    h[authHeader] = authHeader.toLowerCase() === "authorization" ? `Bearer ${provider.apiKey}` : provider.apiKey;
  }
  return h;
}

export async function embed(
  provider: ProviderConfig,
  model: string,
  input: string,
): Promise<number[]> {
  const url = `${provider.baseURL.replace(/\/$/, "")}/embeddings`;
  const res = await fetch(url, {
    method: "POST",
    headers: headersFor(provider),
    body: JSON.stringify({ model, input }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`embeddings ${res.status}: ${t.slice(0, 200)}`);
  }
  const json = (await res.json()) as { data?: Array<{ embedding?: number[] }> };
  const vec = json.data?.[0]?.embedding;
  if (!Array.isArray(vec)) throw new Error("No embedding in response");
  return vec;
}

export function cosine(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
