import { eq } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { traces } from '../db/schema.js';
import { formatRange } from '../ingest/time.js';
import type { ChatTurn, Llm } from '../llm/llm.js';
import { ANSWER_SYSTEM_PROMPT } from '../llm/prompts.js';
import type { MeetingService } from '../meetings/service.js';
import type { Metrics } from '../observability/metrics.js';
import type { RetrievedChunk, Retriever } from '../retrieval/search.js';
import {
  buildMessages,
  renderContext,
  selectWithinBudget,
  type MeetingContext,
} from './context.js';
import {
  checkAttributions,
  checkCitations,
  detectInjection,
  validateQuestion,
} from './guardrails.js';
import { resolveScope, type ResolvedScope } from './scope.js';

export class NoMeetingsError extends Error {}

export interface ChatRequest {
  question: string;
  history: ChatTurn[];
  pinnedMeetings: number[];
  signal?: AbortSignal;
}

export interface SourceView {
  label: string;
  meetingNumber: number;
  meetingTitle: string;
  startSec: number;
  endSec: number;
  speakers: string[];
  content: string;
}

export interface ChatDone {
  cited: string[];
  unknownCitations: string[];
  unverifiedAttributions: string[];
  flags: string[];
}

export interface ChatEvents {
  onStart(meta: {
    traceId: string;
    scope: ResolvedScope;
    sources: SourceView[];
    flags: string[];
  }): void;
  onDelta(text: string): void;
  onDone(result: ChatDone): void;
}

export interface ChatServiceOptions {
  maxQuestionChars: number;
  contextCharBudget: number;
}

const TOTAL_CHUNKS = 16;
const BRIEF_NOTES_ABOVE = 4;

export function perMeetingLimit(meetingCount: number): number {
  if (meetingCount <= 1) return 10;
  if (meetingCount <= 3) return 5;
  return 3;
}

export class ChatService {
  constructor(
    private readonly db: Db,
    private readonly meetings: MeetingService,
    private readonly retriever: Retriever,
    private readonly llm: Llm,
    private readonly metrics: Metrics,
    private readonly options: ChatServiceOptions,
  ) {}

  async answer(request: ChatRequest, events: ChatEvents): Promise<void> {
    const started = performance.now();
    const question = validateQuestion(request.question, this.options.maxQuestionChars);
    const all = await this.meetings.list();
    if (!all.length)
      throw new NoMeetingsError('Upload a meeting transcript before asking questions.');

    const speakers = [...new Set(all.flatMap((m) => m.speakers.map((s) => s.name)))];
    const scope = resolveScope(
      question,
      all.map((m) => ({ id: m.id, number: m.number, title: m.title, occurredOn: m.occurredOn })),
      speakers,
      request.pinnedMeetings,
    );

    const flags: string[] = [];
    if (detectInjection(question)) flags.push('possible_prompt_injection');
    if (scope.unknownNumbers.length) flags.push('unknown_meeting_reference');

    const retrievalStart = performance.now();
    const retrieved = await this.retriever.search(question, {
      meetingIds: scope.meetings.map((m) => m.id),
      speakers: scope.speakers,
      perMeetingLimit: perMeetingLimit(scope.meetings.length),
      totalLimit: TOTAL_CHUNKS,
    });
    this.metrics.retrievalDuration.observe((performance.now() - retrievalStart) / 1000);
    const sources = selectWithinBudget(retrieved, this.options.contextCharBudget);

    const scopedIds = new Set(scope.meetings.map((m) => m.id));
    const items = await this.meetings.actionItems();
    const contexts: MeetingContext[] = all
      .filter((m) => scopedIds.has(m.id))
      .map((m) => ({
        number: m.number,
        title: m.title,
        occurredOn: m.occurredOn,
        durationSec: m.durationSec,
        speakers: m.speakers,
        insights: m.insights,
        actionItems: items.filter((a) => a.meetingId === m.id),
      }));

    const [trace] = await this.db
      .insert(traces)
      .values({
        question,
        scope: scope.meetings.map((m) => m.number),
        retrieved: sources.map(toTrace),
        flags,
        model: this.llm.model,
      })
      .returning({ id: traces.id });

    events.onStart({ traceId: trace!.id, scope, sources: sources.map(toView), flags });

    let firstTokenMs: number | null = null;
    const context = renderContext(contexts, sources, contexts.length > BRIEF_NOTES_ABOVE);
    const result = await this.llm.streamAnswer(
      {
        system: ANSWER_SYSTEM_PROMPT,
        messages: buildMessages(request.history, context, question),
        signal: request.signal,
      },
      (delta) => {
        if (firstTokenMs === null) {
          firstTokenMs = Math.round(performance.now() - started);
          this.metrics.chatFirstToken.observe(firstTokenMs / 1000);
        }
        events.onDelta(delta);
      },
    );

    const citations = checkCitations(
      result.text,
      sources.map((s) => s.label),
    );
    const unverified = checkAttributions(
      result.text,
      sources.map((s) => s.content),
    );
    if (citations.unknown.length) flags.push('unknown_citation');
    if (!citations.cited.length && sources.length) flags.push('no_citations');
    if (unverified.length) flags.push('unverified_attribution');
    if (result.refused) flags.push('refused');

    for (const flag of flags) this.metrics.guardrailFlags.inc({ flag });
    if (result.inputTokens) this.metrics.llmTokens.inc({ direction: 'input' }, result.inputTokens);
    if (result.outputTokens)
      this.metrics.llmTokens.inc({ direction: 'output' }, result.outputTokens);
    this.metrics.chatRequests.inc({ outcome: result.refused ? 'refused' : 'ok' });

    await this.db
      .update(traces)
      .set({
        answer: result.text,
        flags,
        model: result.model,
        latencyMs: Math.round(performance.now() - started),
        firstTokenMs,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      })
      .where(eq(traces.id, trace!.id));

    events.onDone({
      cited: citations.cited,
      unknownCitations: citations.unknown,
      unverifiedAttributions: unverified,
      flags,
    });
  }
}

function toTrace(s: RetrievedChunk) {
  return {
    label: s.label,
    chunkId: s.chunkId,
    range: formatRange(s.startSec, s.endSec),
    score: s.score,
    vectorRank: s.vectorRank,
    keywordRank: s.keywordRank,
    speakerRank: s.speakerRank,
  };
}

function toView(s: RetrievedChunk): SourceView {
  return {
    label: s.label,
    meetingNumber: s.meetingNumber,
    meetingTitle: s.meetingTitle,
    startSec: s.startSec,
    endSec: s.endSec,
    speakers: s.speakers,
    content: s.content,
  };
}
