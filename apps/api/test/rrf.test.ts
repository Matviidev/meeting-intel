import { describe, expect, it } from 'vitest';
import { reciprocalRankFusion } from '../src/retrieval/rrf.js';
import { toOrQuery } from '../src/retrieval/search.js';

describe('reciprocalRankFusion', () => {
  it('rewards items ranked well in both lists', () => {
    const fused = reciprocalRankFusion(
      [
        ['a', 'b', 'c'],
        ['b', 'd', 'c'],
      ],
      (x) => x,
    );
    expect(fused.map((f) => f.item)).toEqual(['b', 'c', 'a', 'd']);
    expect(fused[0]!.ranks).toEqual([2, 1]);
    expect(fused.find((f) => f.item === 'd')!.ranks).toEqual([-1, 2]);
  });
});

describe('toOrQuery', () => {
  it('builds a safe OR query', () => {
    expect(toOrQuery("What's my C++ & Node.js gap? 'drop table")).toBe(
      'what | my | node | js | gap | drop | table',
    );
  });
});
