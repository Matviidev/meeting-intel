import { and, arrayOverlaps, cosineDistance, desc, eq, inArray, sql } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { chunks, meetings } from '../db/schema.js';
import type { Embedder } from '../embeddings/embedder.js';
import { reciprocalRankFusion } from './rrf.js';

export interface RetrievedChunk {
  label: string;
  chunkId: string;
  meetingId: string;
  meetingNumber: number;
  meetingTitle: string;
  startSec: number;
  endSec: number;
  speakers: string[];
  content: string;
  score: number;
  vectorRank: number | null;
  keywordRank: number | null;
  speakerRank: number | null;
}

export interface SearchOptions {
  meetingIds: string[];
  speakers: string[];
  perMeetingLimit: number;
  totalLimit: number;
}

const CANDIDATES = 40;

export function chunkLabel(meetingNumber: number, ordinal: number): string {
  return `M${meetingNumber}.${ordinal + 1}`;
}

export function toOrQuery(text: string): string {
  const words = text.toLowerCase().match(/[a-z0-9][a-z0-9+#]*/g);
  return [...new Set(words ?? [])]
    .map((w) => w.replace(/[+#]/g, ''))
    .filter((w) => w.length > 1)
    .join(' | ');
}

export class Retriever {
  constructor(
    private readonly db: Db,
    private readonly embedder: Embedder,
  ) {}

  async search(query: string, options: SearchOptions): Promise<RetrievedChunk[]> {
    if (!options.meetingIds.length) return [];
    const [queryVector] = await this.embedder.embed([query], 'query');
    const scope = inArray(chunks.meetingId, options.meetingIds);
    const distance = cosineDistance(chunks.embedding, queryVector!);

    const columns = {
      chunkId: chunks.id,
      meetingId: chunks.meetingId,
      ordinal: chunks.ordinal,
      startSec: chunks.startSec,
      endSec: chunks.endSec,
      speakers: chunks.speakers,
      content: chunks.content,
      number: meetings.number,
      title: meetings.title,
    };
    const base = () =>
      this.db.select(columns).from(chunks).innerJoin(meetings, eq(meetings.id, chunks.meetingId));

    const vectorHits = base().where(scope).orderBy(distance).limit(CANDIDATES);

    const orQuery = toOrQuery(query);
    const tsQuery = sql`to_tsquery('english', ${orQuery})`;
    const keywordHits = orQuery
      ? base()
          .where(and(scope, sql`${chunks.tsv} @@ ${tsQuery}`))
          .orderBy(desc(sql`ts_rank_cd(${chunks.tsv}, ${tsQuery})`))
          .limit(CANDIDATES)
      : Promise.resolve([]);

    const speakerHits = options.speakers.length
      ? base()
          .where(and(scope, arrayOverlaps(chunks.speakers, options.speakers)))
          .orderBy(distance)
          .limit(CANDIDATES)
      : Promise.resolve([]);

    const lists = await Promise.all([vectorHits, keywordHits, speakerHits]);
    const fused = reciprocalRankFusion(lists, (r) => r.chunkId);

    const perMeeting = new Map<string, number>();
    const out: RetrievedChunk[] = [];
    for (const { item, score, ranks } of fused) {
      if (out.length >= options.totalLimit) break;
      const taken = perMeeting.get(item.meetingId) ?? 0;
      if (taken >= options.perMeetingLimit) continue;
      perMeeting.set(item.meetingId, taken + 1);
      out.push({
        label: chunkLabel(item.number, item.ordinal),
        chunkId: item.chunkId,
        meetingId: item.meetingId,
        meetingNumber: item.number,
        meetingTitle: item.title,
        startSec: item.startSec,
        endSec: item.endSec,
        speakers: item.speakers,
        content: item.content,
        score: Math.round(score * 10000) / 10000,
        vectorRank: rank(ranks[0]),
        keywordRank: rank(ranks[1]),
        speakerRank: rank(ranks[2]),
      });
    }
    return out;
  }
}

function rank(value: number | undefined): number | null {
  return value !== undefined && value > 0 ? value : null;
}
