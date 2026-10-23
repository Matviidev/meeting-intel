# Working in this repo

Quorum is a pnpm monorepo: `apps/api` (Fastify + Postgres/pgvector + Claude) and `apps/web` (React + Vite + Tailwind v4).

## Commands

- `pnpm test` – all tests (api uses in-memory PGlite, no Docker needed)
- `pnpm typecheck`, `pnpm lint`, `pnpm format:check` – must pass before committing
- `pnpm eval` – retrieval/answer eval over `samples/meetings` (uses Claude when `ANTHROPIC_API_KEY` is set)
- `pnpm db:up && pnpm dev` – local stack

## Rules

- Keep the LLM out of anything that must be deterministic. Claude extracts meeting notes and writes answers; transcript parsing, chunking, scoping, talk-time stats and citation/attribution checks are plain code with unit tests.
- Every LLM or embedding call goes through the `Llm` / `Embedder` interfaces. Tests use `FakeLlm` / `FakeEmbedder`; never call real APIs from tests.
- Transcript text is untrusted. It is wrapped in tags, sanitised with `sanitizeSource`, and the system prompt says to treat it as data. Don't concatenate it into instructions.
- Citations are `M{meeting}.{chunk}`. If you change the label format, change it in `retrieval/search.ts`, `chat/guardrails.ts` and `web/src/lib/citations.ts` together.
- Schema changes go in a new numbered SQL file in `apps/api/migrations`, mirrored in `src/db/schema.ts`.
- New behaviour needs a test next to the existing ones in `apps/api/test` or `*.test.ts(x)` in web.
- No code comments; name things so they don't need them.
- Conventional commits, short subject, no body.

## Where things live

- Ingestion: `src/ingest` (transcript parsing, time, chunking) → `src/meetings/service.ts`
- Retrieval: `src/retrieval` (pgvector + Postgres FTS + speaker filter, fused with RRF)
- Chat orchestration: `src/chat` (scope → retrieve → context → stream → verify → trace)
- Prompts: `src/llm/prompts.ts`
