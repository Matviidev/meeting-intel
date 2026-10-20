import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { createDb } from './db/client.js';
import { migrate } from './db/migrate.js';
import type { Embedder } from './embeddings/embedder.js';
import { FakeEmbedder } from './embeddings/fake.js';
import { LocalEmbedder } from './embeddings/local.js';
import { AnthropicLlm } from './llm/anthropic.js';
import { FakeLlm } from './llm/fake.js';
import type { Llm } from './llm/llm.js';

const config = loadConfig();
const { db, close } = createDb(config.DATABASE_URL);

const llm: Llm =
  config.LLM_PROVIDER === 'fake'
    ? new FakeLlm()
    : new AnthropicLlm({
        apiKey: config.ANTHROPIC_API_KEY,
        model: config.LLM_MODEL,
        extractionEffort: config.LLM_EXTRACTION_EFFORT,
        chatEffort: config.LLM_CHAT_EFFORT,
      });

const local =
  config.EMBEDDINGS_PROVIDER === 'local'
    ? new LocalEmbedder(config.EMBEDDINGS_MODEL, config.MODELS_CACHE_DIR)
    : null;
const embedder: Embedder = local ?? new FakeEmbedder();

await migrate(db);
const app = await buildApp({ config, db, llm, embedder });

if (local) {
  local
    .warmup()
    .then(() => app.log.info({ model: config.EMBEDDINGS_MODEL }, 'embedding model ready'))
    .catch((err: unknown) => app.log.error({ err }, 'embedding model failed to load'));
}

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'shutting down');
  await app.close();
  await close();
  process.exit(0);
};
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

await app.listen({ port: config.PORT, host: config.HOST });
