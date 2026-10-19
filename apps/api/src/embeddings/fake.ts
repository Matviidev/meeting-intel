import { createHash } from 'node:crypto';
import type { Embedder } from './embedder.js';

export class FakeEmbedder implements Embedder {
  readonly dimensions = 384;

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((t) => this.vector(t));
  }

  private vector(text: string): number[] {
    const v = new Array<number>(this.dimensions).fill(0);
    for (const token of text.toLowerCase().match(/[a-z0-9+#.]+/g) ?? []) {
      const h = createHash('sha1').update(token).digest();
      v[h.readUInt16BE(0) % this.dimensions]! += 1;
    }
    const norm = Math.hypot(...v) || 1;
    return v.map((x) => x / norm);
  }
}
