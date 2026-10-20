import type { Insights, SpeakerStat } from '../domain/meeting.js';
import { formatRange, formatTime } from '../ingest/time.js';
import type { ChatTurn } from '../llm/llm.js';
import type { ActionItemView } from '../meetings/service.js';
import type { RetrievedChunk } from '../retrieval/search.js';
import { sanitizeSource } from './guardrails.js';

export const MAX_HISTORY_TURNS = 6;
export const MAX_HISTORY_CHARS = 2000;
const MAX_NOTE_ITEMS = 15;

export interface MeetingContext {
  number: number;
  title: string;
  occurredOn: string | null;
  durationSec: number;
  speakers: SpeakerStat[];
  insights: Insights;
  actionItems: ActionItemView[];
}

const at = (sec: number | null) => (sec === null ? '' : ` (${formatTime(sec)})`);

export function meetingHeading(m: { number: number; title: string; occurredOn: string | null }) {
  return `Meeting #${m.number} (${m.title}${m.occurredOn ? `, ${m.occurredOn}` : ''})`;
}

export function describeMeeting(m: MeetingContext, brief: boolean): string {
  const lines = [
    `${meetingHeading(m)}, ${formatTime(m.durationSec)} long.`,
    `Speakers: ${m.speakers.map((s) => `${s.name} ${Math.round(s.share * 100)}%`).join(', ')}.`,
    `Summary: ${m.insights.summary}`,
  ];
  if (brief) return lines.join('\n');

  const decisions = m.insights.decisions
    .slice(0, MAX_NOTE_ITEMS)
    .map((d) => `- ${d.text}${d.madeBy ? ` — ${d.madeBy}` : ''}${at(d.atSec)}`);
  const actions = m.actionItems
    .slice(0, MAX_NOTE_ITEMS)
    .map(
      (a) =>
        `- [${a.status}] ${a.owner ?? 'Unassigned'}: ${a.task}${a.due ? ` (due ${a.due})` : ''}${at(a.atSec)}`,
    );
  const questions = m.insights.openQuestions.slice(0, MAX_NOTE_ITEMS).map((q) => `- ${q}`);
  return [
    ...lines,
    `Decisions:\n${decisions.join('\n') || '- none recorded'}`,
    `Action items:\n${actions.join('\n') || '- none recorded'}`,
    questions.length ? `Open questions:\n${questions.join('\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function selectWithinBudget(sources: RetrievedChunk[], budget: number): RetrievedChunk[] {
  const out: RetrievedChunk[] = [];
  let used = 0;
  for (const s of sources) {
    if (used + s.content.length > budget) continue;
    out.push(s);
    used += s.content.length;
  }
  return out;
}

export function renderContext(
  meetings: MeetingContext[],
  sources: RetrievedChunk[],
  brief: boolean,
): string {
  const byNumber = new Map(meetings.map((m) => [m.number, m]));
  const ordered = [...sources].sort(
    (a, b) => a.meetingNumber - b.meetingNumber || a.startSec - b.startSec,
  );
  const sourceBlocks = ordered.map((s) => {
    const meeting = byNumber.get(s.meetingNumber);
    const label = meeting ? meetingHeading(meeting) : `Meeting #${s.meetingNumber}`;
    return `<source id="${s.label}" meeting="${label}" time="${formatRange(s.startSec, s.endSec)}" speakers="${s.speakers.join(', ')}">\n${sanitizeSource(s.content)}\n</source>`;
  });
  return [
    '<sources>',
    ...meetings.map(
      (m) =>
        `<meeting_notes number="${m.number}">\n${sanitizeSource(describeMeeting(m, brief))}\n</meeting_notes>`,
    ),
    ...sourceBlocks,
    '</sources>',
  ].join('\n');
}

export function buildMessages(history: ChatTurn[], context: string, question: string): ChatTurn[] {
  const trimmed = history
    .slice(-MAX_HISTORY_TURNS)
    .map((t) => ({ role: t.role, content: t.content.slice(0, MAX_HISTORY_CHARS) }));
  while (trimmed[0]?.role === 'assistant') trimmed.shift();
  return [...trimmed, { role: 'user', content: `${context}\n\nQuestion: ${question}` }];
}
