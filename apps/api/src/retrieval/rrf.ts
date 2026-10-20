export const RRF_K = 60;

export interface Fused<T> {
  item: T;
  score: number;
  ranks: number[];
}

export function reciprocalRankFusion<T>(
  lists: T[][],
  key: (item: T) => string,
  k = RRF_K,
): Fused<T>[] {
  const fused = new Map<string, Fused<T>>();
  lists.forEach((list, listIndex) => {
    list.forEach((item, rank) => {
      const id = key(item);
      const entry = fused.get(id) ?? { item, score: 0, ranks: lists.map(() => -1) };
      entry.score += 1 / (k + rank + 1);
      entry.ranks[listIndex] = rank + 1;
      fused.set(id, entry);
    });
  });
  return [...fused.values()].sort((a, b) => b.score - a.score);
}
