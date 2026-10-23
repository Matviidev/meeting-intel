# Quorum — meeting intelligence

Upload meeting transcripts and ask questions about discussions, decisions and action items. Quorum extracts decisions, action items and open questions from each meeting, and every answer cites the transcript excerpts it used, down to the timestamp.

Screenshots are in `docs/screenshots`.

## Quick start

You need Docker and an Anthropic API key.

```bash
cp .env.example .env            # set ANTHROPIC_API_KEY
docker compose --env-file .env up --build
open http://localhost:8080
```

Upload the transcripts in `samples/meetings/` (one project across three meetings, in `.txt`, `.vtt` and `.md`).

Local development:

```bash
pnpm install
pnpm db:up                      # Postgres 17 + pgvector
pnpm dev                        # api :3000, web :5173
pnpm test                       # api + web tests, no Docker needed
pnpm eval                       # retrieval/answer eval over samples/
```

No API key? Set `LLM_PROVIDER=fake` to run everything with a deterministic stand-in model.

Transcripts need speaker labels and timestamps, e.g. `[00:01:23] Priya: …`, `Priya (01:23): …`, Otter/Zoom exports, WebVTT or SRT.

## How it works

**Upload:** parse into turns (`start`, `speaker`, `text`) → compute talk time → Claude extracts notes (summary, decisions, action items, open questions, each with a timestamp) as typed structured output → chunk by speaker turns → embed and store in Postgres.

**Question:** resolve scope (meeting numbers, dates, titles like "the retro", people) → hybrid retrieval (vector + full-text + speaker filter, fused with RRF) → prompt with meeting notes and timestamped excerpts → stream the answer → verify citations and speaker/time attributions → store a trace.

Code layout: `apps/api` (Fastify), `apps/web` (React), `samples/`.

## RAG / LLM decisions

- **LLM: Claude Opus 5.5.** Telling a proposal from a decision, and noticing when a later meeting changes an earlier one, needs reasoning. Extraction runs once per transcript, so its cost is paid once. The model is configurable (`LLM_MODEL`).
- **Embeddings: `bge-small-en-v1.5`, local (ONNX).** No second API key and data stays local. Swappable behind an `Embedder` interface.
- **Vector DB: Postgres + pgvector.** Data is small and relational; one database gives vectors, full-text search, speaker array filters and transactions. Tests run on PGlite (real Postgres in WASM).
- **Orchestration: plain TypeScript, no framework.** Five explicit steps are easier to read and test than a framework abstraction.
- **Chunking: by speaker turns,** up to ~1,000 characters, never splitting a turn, with one short turn of overlap. Each chunk keeps its time range and speakers, so citations map to a moment in the transcript.
- **Retrieval: hybrid with RRF.** Keywords catch exact terms (card brands, dates, sprint numbers), vectors catch paraphrase, and a speaker-filtered list boosts turns by a person named in the question. Per-meeting caps keep one meeting from crowding out the others.
- **Prompt and context:** a stable, cached system prompt; context only in the latest turn; history capped at 6 turns. Meeting notes include the current status of each action item.
- **Guardrails:** transcripts treated as data and sanitised; injection patterns in questions flagged; unknown citations, missing citations and misattributed `Name (mm:ss)` quotes flagged; unknown meeting references flagged; input size limits and Zod validation on every route.
- **Quality:** unit tests for parsing, chunking, scope, retrieval fusion and guardrails; integration tests for the full HTTP flow; an eval reporting scope accuracy, recall, MRR, flag accuracy and citation/attribution validity. Baseline with local embeddings: scope 1.0, recall 1.0, MRR 0.40.
- **Observability:** structured logs with request ids, Prometheus `/metrics`, a stored trace per answer (scope, ranks, latency, tokens, flags, feedback) shown in the UI.

## Key technical decisions

- LLM extracts and writes; code does everything that must be repeatable (parsing, stats, scope, retrieval, checks).
- Notes are extracted once at upload and reused by the UI and the prompt, so they never disagree.
- Action items are stored state, not text: ticking one off changes what the assistant reports as open.
- Meetings get stable numbers (`#1`, `#2`) used in the UI, prompt, citations and traces.
- SSE for streaming; dependencies injected at the app factory so the full stack runs with fakes in tests.

## Productionizing

- Auth, organisations and row-level security in Postgres.
- Async ingestion: S3 upload → queue → workers for parse/extract/embed, with retries.
- API and workers on ECS Fargate / Cloud Run, web on S3 + CloudFront, Aurora Postgres with pgvector.
- Hosted embeddings, voice transcription with diarization, Zoom/Meet/Teams integrations.
- Encryption, retention policies, audit logs; OpenTelemetry tracing and alerts on latency, errors and guardrail flags.
- IaC (Terraform/CDK), image push and migrations in CI/CD, the eval as a gate for prompt or model changes.

## Engineering standards

Followed: strict TypeScript, Zod at every boundary, ESLint + Prettier and tests in CI, fakes behind interfaces instead of mocks, multi-stage Docker builds with a non-root user, conventional commits.

Skipped: auth, async ingestion, browser E2E tests.

## How I used AI tools

<!-- Write this in your own words. -->

## What I'd do with more time

- Voice-to-transcript with diarization.
- A reranker and a recency preference for "what's the current plan?" questions.
- Link decisions across meetings when a later one supersedes an earlier one.
- A labelled eval for extraction quality and a larger, noisier transcript set.
- Speaker alias resolution ("Tom" vs "Thomas Becker" vs "SPEAKER_02").
