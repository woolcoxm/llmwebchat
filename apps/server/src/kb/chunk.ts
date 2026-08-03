/** Naive overlapping chunker for RAG ingestion. No deps. */

export interface Chunk {
  text: string;
  index: number;
}

export function chunkText(text: string, maxChars = 800, overlap = 120): Chunk[] {
  const clean = text.replace(/\r\n/g, "\n");
  if (clean.length <= maxChars) return [{ text: clean.trim(), index: 0 }].filter((c) => c.text);

  const chunks: Chunk[] = [];
  let i = 0;
  while (i < clean.length) {
    let end = Math.min(i + maxChars, clean.length);
    // try to break on a sentence/paragraph boundary near the end
    if (end < clean.length) {
      const slice = clean.slice(i, end);
      const boundary = Math.max(
        slice.lastIndexOf("\n\n"),
        slice.lastIndexOf(". "),
        slice.lastIndexOf("\n"),
      );
      if (boundary > maxChars * 0.4) end = i + boundary + 1;
    }
    const text2 = clean.slice(i, end).trim();
    if (text2) chunks.push({ text: text2, index: chunks.length });
    if (end >= clean.length) break;
    i = end - overlap;
    if (i < 0) i = 0;
  }
  return chunks;
}
