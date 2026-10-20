import { desc, eq } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { traces } from '../db/schema.js';

export const traceRoutes: FastifyPluginAsync = async (base) => {
  const app = base.withTypeProvider<ZodTypeProvider>();
  const { db } = app.deps;

  app.get(
    '/traces',
    {
      schema: {
        querystring: z.object({ limit: z.coerce.number().int().min(1).max(100).default(20) }),
      },
    },
    async (req) => ({
      traces: await db.select().from(traces).orderBy(desc(traces.createdAt)).limit(req.query.limit),
    }),
  );

  app.get('/traces/:id', { schema: { params: z.object({ id: z.uuid() }) } }, async (req) => {
    const [trace] = await db.select().from(traces).where(eq(traces.id, req.params.id));
    if (!trace) throw app.httpErrors.notFound('Trace not found.');
    return { trace };
  });

  app.post(
    '/traces/:id/feedback',
    {
      schema: {
        params: z.object({ id: z.uuid() }),
        body: z.object({ value: z.union([z.literal(1), z.literal(-1)]) }),
      },
    },
    async (req, reply) => {
      const updated = await db
        .update(traces)
        .set({ feedback: req.body.value })
        .where(eq(traces.id, req.params.id))
        .returning({ id: traces.id });
      if (!updated.length) throw app.httpErrors.notFound('Trace not found.');
      return reply.code(204).send();
    },
  );
};
