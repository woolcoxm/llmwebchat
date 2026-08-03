/** knowledge_search tool — embeds the query and returns top-k KB chunks. */
import type { ProviderConfig, ToolDef } from "@llmwebchat/shared";
import { embed } from "../kb/embed.js";
import { searchKb } from "../kb/store.js";

export const knowledgeSearchDef: ToolDef = {
  name: "knowledge_search",
  description:
    "Search the local knowledge base for passages relevant to a query and return the top results. Use when the user asks about ingested documents. Returns source + score + text for each hit.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "What to look for in the knowledge base" },
      k: { type: "integer", description: "Number of results (default 4)", default: 4 },
    },
    required: ["query"],
    additionalProperties: false,
  },
};

export function makeKnowledgeSearch(provider: ProviderConfig, model: string) {
  return async (args: { query: string; k?: number }) => {
    const vec = await embed(provider, model, args.query);
    const hits = searchKb(vec, Math.min(Math.max(args.k ?? 4, 1), 12));
    if (!hits.length) return "No documents in the knowledge base yet. Ingest some first via Settings.";
    return hits
      .map(
        (h, i) =>
          `### [${i + 1}] (${h.score.toFixed(3)}) ${h.item.source}\n${h.item.text}`,
      )
      .join("\n\n");
  };
}
