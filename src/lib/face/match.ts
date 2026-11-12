/** Euclidean distance between two equal-length descriptor vectors. */
export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) {
    return Number.POSITIVE_INFINITY;
  }
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i]! - b[i]!;
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/** Average several embeddings into one (used during enrollment). */
export function averageEmbeddings(embeddings: number[][]): number[] {
  if (embeddings.length === 0) return [];
  const dim = embeddings[0]!.length;
  const out = new Array<number>(dim).fill(0);
  for (const emb of embeddings) {
    if (emb.length !== dim) continue;
    for (let i = 0; i < dim; i++) {
      out[i]! += emb[i]!;
    }
  }
  for (let i = 0; i < dim; i++) {
    out[i]! /= embeddings.length;
  }
  return out;
}

export type MatchCandidate = {
  employeeId: string;
  embedding: number[];
};

export type MatchResult = {
  employeeId: string;
  distance: number;
} | null;

/**
 * Find the best matching employee by lowest Euclidean distance.
 * Returns null when no candidate is under the threshold.
 */
export function findBestMatch(
  probe: number[],
  candidates: MatchCandidate[],
  threshold: number,
): MatchResult {
  let best: MatchResult = null;
  for (const c of candidates) {
    const distance = euclideanDistance(probe, c.embedding);
    if (distance <= threshold && (!best || distance < best.distance)) {
      best = { employeeId: c.employeeId, distance };
    }
  }
  return best;
}

export function parseEmbedding(raw: unknown): number[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const nums = raw.map((v) => Number(v));
  if (nums.some((n) => !Number.isFinite(n))) return null;
  return nums;
}
