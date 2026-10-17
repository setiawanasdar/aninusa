/**
 * Aggressive normalization used for title matching and search fallbacks.
 * Unicode-aware: Japanese titles survive, punctuation and spacing do not.
 */
export function normalizeTitle(input: string): string {
  return input
    .normalize("NFKC")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[’'`]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function titleTokens(input: string): string[] {
  return normalizeTitle(input)
    .split(" ")
    .filter((token) => token.length > 0);
}

export function jaroWinkler(left: string, right: string): number {
  if (left === right) return 1;
  if (!left.length || !right.length) return 0;

  const matchDistance = Math.max(Math.floor(Math.max(left.length, right.length) / 2) - 1, 0);
  const leftMatches = new Array<boolean>(left.length).fill(false);
  const rightMatches = new Array<boolean>(right.length).fill(false);
  let matches = 0;

  for (let i = 0; i < left.length; i += 1) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, right.length);
    for (let j = start; j < end; j += 1) {
      if (rightMatches[j] || left[i] !== right[j]) continue;
      leftMatches[i] = true;
      rightMatches[j] = true;
      matches += 1;
      break;
    }
  }

  if (matches === 0) return 0;

  let transpositions = 0;
  let cursor = 0;
  for (let i = 0; i < left.length; i += 1) {
    if (!leftMatches[i]) continue;
    while (!rightMatches[cursor]) cursor += 1;
    if (left[i] !== right[cursor]) transpositions += 1;
    cursor += 1;
  }

  const m = matches;
  const jaro = (m / left.length + m / right.length + (m - transpositions / 2) / m) / 3;
  const prefix = Math.min(4, commonPrefixLength(left, right));
  return jaro + prefix * 0.1 * (1 - jaro);
}

function commonPrefixLength(left: string, right: string): number {
  const limit = Math.min(left.length, right.length, 4);
  let index = 0;
  while (index < limit && left[index] === right[index]) index += 1;
  return index;
}

export function tokenJaccard(left: string, right: string): number {
  const a = new Set(titleTokens(left));
  const b = new Set(titleTokens(right));
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return intersection / (a.size + b.size - intersection);
}

export function titleSimilarity(left: string, right: string): number {
  const a = normalizeTitle(left);
  const b = normalizeTitle(right);
  if (!a || !b) return 0;
  if (a === b) return 1;

  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  if (shorter.length >= 4 && longer.includes(shorter)) {
    return Math.max(0.9, jaroWinkler(a, b));
  }

  return Math.max(jaroWinkler(a, b), tokenJaccard(a, b) * 0.95);
}
