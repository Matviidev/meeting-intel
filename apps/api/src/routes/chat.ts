import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';

const chatBody = z.object({
  question: z.string(),
  history: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() }))
    .max(50)
    .default([]),
  pinnedMeetings: z.array(z.number().int().positive()).max(10).default([]),
});

export const chatRoutes: FastifyPluginAsync = async (base) => {
  const app = base.withTypeProvider<ZodTypeProvider>();

  app.post('/chat', { schema: { body: chatBody } }, async (req, reply) => {
    const abort = new AbortController();
    req.raw.on('close', () => abort.abort());

    const write = (event: string, data: unknown) => {
      reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      reply.hijack();
      reply.raw.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache, no-transform',
        connection: 'keep-alive',
        'x-accel-buffering': 'no',
        'x-request-id': req.id,
        ...corsHeaders(req.headers.origin, app.deps.config.CORS_ORIGIN),
      });
    };

    try {
      await app.deps.chat.answer(
        { ...req.body, signal: abort.signal },
        {
          onStart: (meta) => {
            start();
            write('meta', {
              traceId: meta.traceId,
              scope: {
                reason: meta.scope.reason,
                meetings: meta.scope.meetings.map((m) => m.number),
                unknown: meta.scope.unknownNumbers,
                speakers: meta.scope.speakers,
              },
              sources: meta.sources,
              flags: meta.flags,
            });
          },
          onDelta: (text) => write('delta', { text }),
          onDone: (result) => write('done', result),
        },
      );
    } catch (err) {
      if (!started) throw err;
      req.log.error({ err }, 'chat stream failed');
      app.deps.metrics.chatRequests.inc({ outcome: 'error' });
      if (!abort.signal.aborted)
        write('error', { message: 'The assistant failed to finish this answer. Please retry.' });
    }
    reply.raw.end();
  });
};

function corsHeaders(origin: string | undefined, allowed: string): Record<string, string> {
  if (!origin || !allowed.split(',').includes(origin)) return {};
  return { 'access-control-allow-origin': origin, vary: 'Origin' };
}
