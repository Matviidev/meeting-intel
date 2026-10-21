import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import { drizzle } from 'drizzle-orm/pglite';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDeps } from '../src/app.js';
import type { SourceView } from '../src/chat/service.js';
import { loadConfig } from '../src/config.js';
import type { Db } from '../src/db/client.js';
import { migrate } from '../src/db/migrate.js';
import * as schema from '../src/db/schema.js';
import { FakeEmbedder } from '../src/embeddings/fake.js';
import { LocalEmbedder } from '../src/embeddings/local.js';
import { readTranscriptFile } from '../src/ingest/transcript.js';
import { AnthropicLlm } from '../src/llm/anthropic.js';
import { FakeLlm } from '../src/llm/fake.js';
import { Metrics } from '../src/observability/metrics.js';

interface ExpectedSource {
  meeting: number;
  text: string;
}

interface Case {
  question: string;
  expectScope: number[];
  expectSources: ExpectedSource[];
  mustMention?: string[];
  expectFlags?: string[];
}

interface ChatMeta {
  scope: number[];
  sources: SourceView[];
}

const here = path.dirname(fileURLToPath(import.meta.url));
const samples = path.resolve(here, '../../../samples/meetings');

const config = loadConfig({ ...process.env, NODE_ENV: 'test' });
const useRealLlm = !!config.ANTHROPIC_API_KEY && process.env.EVAL_LLM !== 'fake';
const llm = useRealLlm
  ? new AnthropicLlm({
      apiKey: config.ANTHROPIC_API_KEY,
      model: config.LLM_MODEL,
      extractionEffort: config.LLM_EXTRACTION_EFFORT,
      chatEffort: config.LLM_CHAT_EFFORT,
    })
  : new FakeLlm();
const embedder =
  process.env.EVAL_EMBEDDINGS === 'fake'
    ? new FakeEmbedder()
    : new LocalEmbedder(config.EMBEDDINGS_MODEL, config.MODELS_CACHE_DIR);

const client = new PGlite({ extensions: { vector } });
const db = drizzle(client, { schema }) as unknown as Db;
await migrate(db);
const deps = createDeps({ config, db, llm, embedder, metrics: new Metrics(false) });

for (const file of (await readdir(samples)).sort()) {
  await deps.meetings.ingest({
    sourceName: file,
    text: readTranscriptFile(file, await readFile(path.join(samples, file))),
  });
}

const cases: Case[] = JSON.parse(await readFile(path.join(here, 'dataset.json'), 'utf8'));
const rows: Record<string, string | number>[] = [];
let scopeHits = 0;
let recallSum = 0;
let rrSum = 0;
let rrCases = 0;
let flagHits = 0;
let flagCases = 0;
let citationValid = 0;
let attributionValid = 0;
let mentionHits = 0;
let mentionTotal = 0;

for (const c of cases) {
  let meta: ChatMeta | undefined;
  let text = '';
  let flags: string[] = [];
  let unknown: string[] = [];
  let unverified: string[] = [];
  await deps.chat.answer(
    { question: c.question, history: [], pinnedMeetings: [] },
    {
      onStart: (m) => {
        meta = { scope: m.scope.meetings.map((x) => x.number), sources: m.sources };
      },
      onDelta: (d) => {
        text += d;
      },
      onDone: (d) => {
        flags = d.flags;
        unknown = d.unknownCitations;
        unverified = d.unverifiedAttributions;
      },
    },
  );

  const scopeOk =
    JSON.stringify([...meta!.scope].sort()) === JSON.stringify([...c.expectScope].sort());
  const matches = (e: ExpectedSource) => (s: SourceView) =>
    s.meetingNumber === e.meeting && s.content.toLowerCase().includes(e.text.toLowerCase());
  const found = c.expectSources.filter((e) => meta!.sources.some(matches(e))).length;
  const firstHit = meta!.sources.findIndex((s) => c.expectSources.some((e) => matches(e)(s)));
  const recall = c.expectSources.length ? found / c.expectSources.length : 1;
  const rr = firstHit >= 0 ? 1 / (firstHit + 1) : 0;
  if (c.expectSources.length) {
    rrSum += rr;
    rrCases++;
  }
  scopeHits += Number(scopeOk);
  recallSum += recall;
  if (c.expectFlags) {
    flagCases++;
    flagHits += Number(c.expectFlags.every((f) => flags.includes(f)));
  }
  citationValid += Number(unknown.length === 0);
  attributionValid += Number(unverified.length === 0);
  const mentions = (c.mustMention ?? []).filter((m) =>
    text.toLowerCase().includes(m.toLowerCase()),
  ).length;
  mentionHits += mentions;
  mentionTotal += c.mustMention?.length ?? 0;

  rows.push({
    question: c.question.slice(0, 52),
    scope: scopeOk ? 'ok' : `got ${meta!.scope.join(',')}`,
    sources: meta!.sources.length,
    recall: recall.toFixed(2),
    rr: c.expectSources.length ? rr.toFixed(2) : '-',
    citations: unknown.length ? `bad: ${unknown.join(',')}` : 'ok',
    mentions: c.mustMention ? `${mentions}/${c.mustMention.length}` : '-',
  });
}

console.table(rows);
const n = cases.length;
const summary = {
  llm: llm.model,
  embeddings: embedder instanceof LocalEmbedder ? config.EMBEDDINGS_MODEL : 'fake',
  scopeAccuracy: +(scopeHits / n).toFixed(2),
  sourceRecall: +(recallSum / n).toFixed(2),
  mrr: rrCases ? +(rrSum / rrCases).toFixed(2) : null,
  guardrailFlagAccuracy: flagCases ? +(flagHits / flagCases).toFixed(2) : null,
  citationValidity: +(citationValid / n).toFixed(2),
  attributionValidity: +(attributionValid / n).toFixed(2),
  mustMentionRate:
    useRealLlm && mentionTotal ? +(mentionHits / mentionTotal).toFixed(2) : 'n/a (fake LLM)',
};
console.log(summary);
await client.close();

const minRecall = Number(process.env.EVAL_MIN_RECALL ?? 0);
if (summary.scopeAccuracy < 1 || summary.sourceRecall < minRecall) process.exit(1);
