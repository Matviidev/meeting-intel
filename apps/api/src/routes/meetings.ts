import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { MeetingRow } from '../db/schema.js';
import { UnsupportedFileError, readTranscriptFile } from '../ingest/transcript.js';
import type { IngestInput } from '../meetings/service.js';
import { isAudioFile } from '../transcribe/audio.js';

const textBody = z.object({
  text: z.string().min(1),
  sourceName: z.string().max(200).optional(),
});

const idParams = z.object({ id: z.uuid() });

async function readInput(req: FastifyRequest): Promise<IngestInput> {
  if (req.isMultipart()) {
    const file = await req.file();
    if (!file) throw req.server.httpErrors.badRequest('No file uploaded.');
    const buffer = await file.toBuffer();
    if (isAudioFile(file.filename)) return transcribe(req, file.filename, buffer);
    const maxMb = req.server.deps.config.MAX_UPLOAD_MB;
    if (buffer.byteLength > maxMb * 1024 * 1024) {
      throw req.server.httpErrors.payloadTooLarge(`Max transcript size is ${maxMb} MB.`);
    }
    return { sourceName: file.filename, text: readTranscriptFile(file.filename, buffer) };
  }
  const body = textBody.parse(req.body);
  return { sourceName: body.sourceName ?? 'Pasted transcript', text: body.text.trim() };
}

async function transcribe(
  req: FastifyRequest,
  filename: string,
  audio: Buffer,
): Promise<IngestInput> {
  const { transcription, metrics } = req.server.deps;
  if (!transcription) throw new UnsupportedFileError('Audio transcription is turned off.');
  const end = metrics.transcribeDuration.startTimer();
  const text = await transcription.toTranscript(filename, audio);
  const seconds = end();
  req.log.info({ filename, bytes: audio.byteLength, seconds }, 'audio transcribed');
  return { sourceName: filename, text };
}

export function summary(meeting: MeetingRow, openActions = 0) {
  return {
    id: meeting.id,
    number: meeting.number,
    title: meeting.title,
    occurredOn: meeting.occurredOn,
    sourceName: meeting.sourceName,
    durationSec: meeting.durationSec,
    speakers: meeting.speakers,
    summary: meeting.insights.summary,
    decisionCount: meeting.insights.decisions.length,
    openActionCount: openActions,
    createdAt: meeting.createdAt,
  };
}

export const meetingRoutes: FastifyPluginAsync = async (base) => {
  const app = base.withTypeProvider<ZodTypeProvider>();
  const { meetings, metrics } = app.deps;

  app.get('/meetings', async () => {
    const [rows, items] = await Promise.all([meetings.list(), meetings.actionItems()]);
    return {
      meetings: rows.map((m) =>
        summary(m, items.filter((a) => a.meetingId === m.id && a.status === 'open').length),
      ),
    };
  });

  app.post('/meetings', async (req, reply) => {
    const input = await readInput(req);
    const end = metrics.ingestDuration.startTimer();
    const meeting = await meetings.ingest(input);
    end();
    metrics.extractedItems.inc({ kind: 'decision' }, meeting.insights.decisions.length);
    metrics.extractedItems.inc({ kind: 'action_item' }, meeting.insights.actionItems.length);
    req.log.info(
      { meetingId: meeting.id, number: meeting.number, utterances: meeting.utterances.length },
      'meeting ingested',
    );
    return reply.code(201).send({ meeting: summary(meeting, meeting.insights.actionItems.length) });
  });

  app.get('/meetings/:id', { schema: { params: idParams } }, async (req) => {
    const meeting = await meetings.get(req.params.id);
    if (!meeting) throw app.httpErrors.notFound('Meeting not found.');
    const actionItems = await meetings.actionItems(meeting.id);
    return {
      meeting: {
        ...summary(meeting, actionItems.filter((a) => a.status === 'open').length),
        insights: meeting.insights,
        utterances: meeting.utterances,
      },
      actionItems,
    };
  });

  app.delete('/meetings/:id', { schema: { params: idParams } }, async (req, reply) => {
    if (!(await meetings.delete(req.params.id)))
      throw app.httpErrors.notFound('Meeting not found.');
    return reply.code(204).send();
  });

  app.get(
    '/action-items',
    {
      schema: {
        querystring: z.object({ status: z.enum(['open', 'done', 'all']).default('all') }),
      },
    },
    async (req) => {
      const items = await meetings.actionItems();
      const status = req.query.status;
      return { actionItems: status === 'all' ? items : items.filter((a) => a.status === status) };
    },
  );

  app.patch(
    '/action-items/:id',
    { schema: { params: idParams, body: z.object({ status: z.enum(['open', 'done']) }) } },
    async (req, reply) => {
      if (!(await meetings.setActionStatus(req.params.id, req.body.status))) {
        throw app.httpErrors.notFound('Action item not found.');
      }
      return reply.code(204).send();
    },
  );
};
