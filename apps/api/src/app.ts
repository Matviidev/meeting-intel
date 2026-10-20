import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import sensible from '@fastify/sensible';
import Fastify, { type FastifyError } from 'fastify';
import {
  hasZodFastifySchemaValidationErrors,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';
import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';
import { QuestionRejectedError } from './chat/guardrails.js';
import { ChatService, NoMeetingsError } from './chat/service.js';
import type { Config } from './config.js';
import type { Db } from './db/client.js';
import type { Embedder } from './embeddings/embedder.js';
import { InvalidTranscriptError, UnsupportedFileError } from './ingest/transcript.js';
import { ExtractionError, type Llm } from './llm/llm.js';
import { InvalidDocumentError, MeetingService } from './meetings/service.js';
import { loggerOptions } from './observability/logger.js';
import { Metrics } from './observability/metrics.js';
import { Retriever } from './retrieval/search.js';
import { chatRoutes } from './routes/chat.js';
import { healthRoutes } from './routes/health.js';
import { meetingRoutes } from './routes/meetings.js';
import { traceRoutes } from './routes/traces.js';

export interface AppDeps {
  config: Config;
  db: Db;
  llm: Llm;
  embedder: Embedder;
  metrics: Metrics;
  meetings: MeetingService;
  chat: ChatService;
}

declare module 'fastify' {
  interface FastifyInstance {
    deps: AppDeps;
  }
}

export interface BuildAppInput {
  config: Config;
  db: Db;
  llm: Llm;
  embedder: Embedder;
  metrics?: Metrics;
}

export function createDeps({ config, db, llm, embedder, metrics }: BuildAppInput): AppDeps {
  const m = metrics ?? new Metrics(config.NODE_ENV !== 'test');
  const meetings = new MeetingService(db, llm, embedder);
  const chat = new ChatService(db, meetings, new Retriever(db, embedder), llm, m, {
    maxQuestionChars: config.MAX_QUESTION_CHARS,
    contextCharBudget: config.CONTEXT_CHAR_BUDGET,
  });
  return { config, db, llm, embedder, metrics: m, meetings, chat };
}

export async function buildApp(input: BuildAppInput) {
  const deps = createDeps(input);
  const { config, metrics } = deps;

  const app = Fastify({
    logger: loggerOptions(config),
    genReqId: (req) => (req.headers['x-request-id'] as string | undefined) ?? randomUUID(),
    bodyLimit: config.MAX_UPLOAD_MB * 1024 * 1024,
  });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorate('deps', deps);

  await app.register(sensible);
  await app.register(cors, {
    origin: config.CORS_ORIGIN.split(','),
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  });
  await app.register(multipart, {
    limits: { fileSize: config.MAX_UPLOAD_MB * 1024 * 1024, files: 1 },
  });

  app.addHook('onSend', async (req, reply) => {
    reply.header('x-request-id', req.id);
  });
  app.addHook('onResponse', async (req, reply) => {
    metrics.httpDuration.observe(
      { method: req.method, route: req.routeOptions.url ?? 'unknown', status: reply.statusCode },
      reply.elapsedTime / 1000,
    );
  });

  app.setErrorHandler((err: FastifyError, req, reply) => {
    if (hasZodFastifySchemaValidationErrors(err)) {
      return reply
        .code(400)
        .send({ error: 'validation_error', message: 'Invalid request.', details: err.validation });
    }
    if (err instanceof ZodError) {
      return reply
        .code(400)
        .send({ error: 'validation_error', message: 'Invalid request.', details: err.issues });
    }
    if (
      err instanceof UnsupportedFileError ||
      err instanceof InvalidDocumentError ||
      err instanceof InvalidTranscriptError
    ) {
      return reply.code(422).send({ error: 'invalid_transcript', message: err.message });
    }
    if (err instanceof QuestionRejectedError) {
      return reply.code(400).send({ error: 'invalid_question', message: err.message });
    }
    if (err instanceof NoMeetingsError) {
      return reply.code(409).send({ error: 'no_meetings', message: err.message });
    }
    if (err instanceof ExtractionError) {
      req.log.warn({ err }, 'extraction failed');
      return reply.code(502).send({
        error: 'extraction_failed',
        message: 'Could not analyse the transcript. Try again.',
      });
    }
    if (err.code === 'FST_REQ_FILE_TOO_LARGE' || err.code === 'FST_ERR_CTP_BODY_TOO_LARGE') {
      return reply.code(413).send({
        error: 'file_too_large',
        message: `Max upload size is ${config.MAX_UPLOAD_MB} MB.`,
      });
    }
    const status = err.statusCode ?? 500;
    if (status >= 500) req.log.error({ err }, 'request failed');
    return reply.code(status).send({
      error: status >= 500 ? 'internal_error' : 'request_error',
      message: status >= 500 ? 'Something went wrong.' : err.message,
    });
  });

  await app.register(healthRoutes);
  app.get('/metrics', async (_req, reply) =>
    reply.type(metrics.registry.contentType).send(await metrics.registry.metrics()),
  );
  await app.register(
    async (api) => {
      await api.register(meetingRoutes);
      await api.register(chatRoutes);
      await api.register(traceRoutes);
    },
    { prefix: '/api' },
  );

  return app;
}
