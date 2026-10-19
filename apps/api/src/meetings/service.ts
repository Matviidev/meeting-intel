import { asc, eq, max } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { actionItems, chunks, meetings, type MeetingRow } from '../db/schema.js';
import type { Insights } from '../domain/meeting.js';
import type { Embedder } from '../embeddings/embedder.js';
import { chunkTranscript } from '../ingest/chunk.js';
import { formatRange } from '../ingest/time.js';
import { estimateDuration, parseTranscript, speakerStats } from '../ingest/transcript.js';
import type { Llm } from '../llm/llm.js';

export const MIN_TEXT_CHARS = 200;
export const MAX_TEXT_CHARS = 200_000;

export class InvalidDocumentError extends Error {}

export interface IngestInput {
  sourceName: string;
  text: string;
}

export interface ActionItemView {
  id: string;
  meetingId: string;
  meetingNumber: number;
  meetingTitle: string;
  owner: string | null;
  task: string;
  due: string | null;
  atSec: number | null;
  status: 'open' | 'done';
}

export class MeetingService {
  constructor(
    private readonly db: Db,
    private readonly llm: Llm,
    private readonly embedder: Embedder,
  ) {}

  async ingest({ sourceName, text }: IngestInput): Promise<MeetingRow> {
    assertUsable(text);
    const { preamble, utterances } = parseTranscript(text);
    const durationSec = estimateDuration(utterances);
    const insights = clampInsights(
      await this.llm.extractInsights({ preamble, utterances }),
      durationSec,
    );
    const title = insights.title.trim() || sourceName;
    const pieces = chunkTranscript(utterances, durationSec);
    const vectors = await this.embedder.embed(
      pieces.map((c) => `${title} — ${formatRange(c.startSec, c.endSec)}\n${c.content}`),
      'passage',
    );

    return this.db.transaction(async (tx) => {
      const [{ value } = { value: 0 }] = await tx
        .select({ value: max(meetings.number) })
        .from(meetings);
      const [meeting] = await tx
        .insert(meetings)
        .values({
          number: (value ?? 0) + 1,
          title,
          occurredOn: insights.occurredOn,
          sourceName,
          content: text,
          utterances,
          durationSec,
          speakers: speakerStats(utterances),
          insights,
        })
        .returning();
      await tx
        .insert(chunks)
        .values(pieces.map((c, i) => ({ ...c, meetingId: meeting!.id, embedding: vectors[i]! })));
      if (insights.actionItems.length) {
        await tx.insert(actionItems).values(
          insights.actionItems.map((a, ordinal) => ({
            meetingId: meeting!.id,
            ordinal,
            owner: a.owner,
            task: a.task,
            due: a.due,
            atSec: a.atSec,
          })),
        );
      }
      return meeting!;
    });
  }

  list(): Promise<MeetingRow[]> {
    return this.db.select().from(meetings).orderBy(asc(meetings.number));
  }

  async get(id: string): Promise<MeetingRow | null> {
    const [meeting] = await this.db.select().from(meetings).where(eq(meetings.id, id));
    return meeting ?? null;
  }

  async delete(id: string): Promise<boolean> {
    const deleted = await this.db
      .delete(meetings)
      .where(eq(meetings.id, id))
      .returning({ id: meetings.id });
    return deleted.length > 0;
  }

  async actionItems(meetingId?: string): Promise<ActionItemView[]> {
    const rows = await this.db
      .select({
        id: actionItems.id,
        meetingId: actionItems.meetingId,
        meetingNumber: meetings.number,
        meetingTitle: meetings.title,
        owner: actionItems.owner,
        task: actionItems.task,
        due: actionItems.due,
        atSec: actionItems.atSec,
        status: actionItems.status,
      })
      .from(actionItems)
      .innerJoin(meetings, eq(meetings.id, actionItems.meetingId))
      .where(meetingId ? eq(actionItems.meetingId, meetingId) : undefined)
      .orderBy(asc(meetings.number), asc(actionItems.ordinal));
    return rows;
  }

  async setActionStatus(id: string, status: 'open' | 'done'): Promise<boolean> {
    const updated = await this.db
      .update(actionItems)
      .set({ status, updatedAt: new Date() })
      .where(eq(actionItems.id, id))
      .returning({ id: actionItems.id });
    return updated.length > 0;
  }
}

function assertUsable(text: string): void {
  if (text.length < MIN_TEXT_CHARS) {
    throw new InvalidDocumentError('Transcript has too little text to analyse.');
  }
  if (text.length > MAX_TEXT_CHARS) {
    throw new InvalidDocumentError(`Transcript is too long (max ${MAX_TEXT_CHARS} characters).`);
  }
}

export function clampInsights(insights: Insights, durationSec: number): Insights {
  const clamp = (sec: number | null) =>
    sec === null || !Number.isFinite(sec)
      ? null
      : Math.min(Math.max(0, Math.round(sec)), durationSec);
  return {
    ...insights,
    occurredOn: /^\d{4}-\d{2}-\d{2}$/.test(insights.occurredOn ?? '') ? insights.occurredOn : null,
    topics: insights.topics.map((t) => ({ ...t, startSec: clamp(t.startSec) })),
    decisions: insights.decisions.map((d) => ({ ...d, atSec: clamp(d.atSec) })),
    actionItems: insights.actionItems.map((a) => ({ ...a, atSec: clamp(a.atSec) })),
  };
}
