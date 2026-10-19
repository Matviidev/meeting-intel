import { env, pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers';
import type { Embedder } from './embedder.js';

const QUERY_PREFIX = 'Represent this sentence for searching relevant passages: ';
const BATCH_SIZE = 16;

export class LocalEmbedder implements Embedder {
  readonly dimensions = 384;
  private extractor?: Promise<FeatureExtractionPipeline>;

  constructor(
    private readonly model: string,
    cacheDir: string,
  ) {
    env.cacheDir = cacheDir;
  }

  warmup(): Promise<unknown> {
    return this.load();
  }

  async embed(texts: string[], kind: 'query' | 'passage'): Promise<number[][]> {
    const extractor = await this.load();
    const inputs = kind === 'query' ? texts.map((t) => QUERY_PREFIX + t) : texts;
    const out: number[][] = [];
    for (let i = 0; i < inputs.length; i += BATCH_SIZE) {
      const batch = inputs.slice(i, i + BATCH_SIZE);
      const tensor = await extractor(batch, { pooling: 'cls', normalize: true });
      out.push(...(tensor.tolist() as number[][]));
    }
    return out;
  }

  private load(): Promise<FeatureExtractionPipeline> {
    this.extractor ??= pipeline('feature-extraction', this.model, {
      dtype: 'q8',
    }) as Promise<FeatureExtractionPipeline>;
    return this.extractor;
  }
}
