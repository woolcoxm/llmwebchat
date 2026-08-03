/** Minimal word-level diff via LCS. Returns aligned parts for two columns. */

export type DiffOp = "same" | "add" | "del";
export interface DiffPart {
  type: DiffOp;
  text: string;
}

function tokenize(s: string): string[] {
  // keep whitespace as separate tokens so rendering preserves spacing
  return s.split(/(\s+)/).filter((t) => t.length > 0);
}

/** Produce left (base a) and right (base b) aligned diff parts. */
export function wordDiff(a: string, b: string): { left: DiffPart[]; right: DiffPart[] } {
  const aw = tokenize(a);
  const bw = tokenize(b);
  const n = aw.length;
  const m = bw.length;
  // LCS length table
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = aw[i] === bw[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const left: DiffPart[] = [];
  const right: DiffPart[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (aw[i] === bw[j]) {
      push(left, "same", aw[i]);
      push(right, "same", bw[j]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      push(left, "del", aw[i]);
      i++;
    } else {
      push(right, "add", bw[j]);
      j++;
    }
  }
  while (i < n) push(left, "del", aw[i++]);
  while (j < m) push(right, "add", bw[j++]);
  return { left, right };
}

function push(arr: DiffPart[], type: DiffOp, text: string) {
  const last = arr[arr.length - 1];
  if (last && last.type === type) last.text += text;
  else arr.push({ type, text });
}
