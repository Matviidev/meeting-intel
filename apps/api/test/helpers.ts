import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import { drizzle } from 'drizzle-orm/pglite';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import type { Db } from '../src/db/client.js';
import { migrate } from '../src/db/migrate.js';
import * as schema from '../src/db/schema.js';
import { FakeEmbedder } from '../src/embeddings/fake.js';
import { FakeLlm } from '../src/llm/fake.js';
import type { Llm } from '../src/llm/llm.js';

export async function createTestDb(): Promise<{ db: Db; close: () => Promise<void> }> {
  const client = new PGlite({ extensions: { vector } });
  const db = drizzle(client, { schema }) as unknown as Db;
  await migrate(db);
  return { db, close: () => client.close() };
}

export async function createTestApp(llm: Llm = new FakeLlm()) {
  const { db, close } = await createTestDb();
  const config = loadConfig({
    NODE_ENV: 'test',
    LLM_PROVIDER: 'fake',
    EMBEDDINGS_PROVIDER: 'fake',
  });
  const app = await buildApp({ config, db, llm, embedder: new FakeEmbedder() });
  return {
    app,
    db,
    close: async () => {
      await app.close();
      await close();
    },
  };
}

export interface SseEvent {
  event: string;
  data: unknown;
}

export function parseSse(body: string): SseEvent[] {
  return body
    .split('\n\n')
    .filter((block) => block.trim())
    .map((block) => {
      const event = /^event: (.+)$/m.exec(block)?.[1] ?? 'message';
      const data = JSON.parse(/^data: (.+)$/m.exec(block)?.[1] ?? 'null');
      return { event, data };
    });
}
