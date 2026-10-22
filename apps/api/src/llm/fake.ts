import type { Insights, Utterance } from '../domain/meeting.js';
import type { AnswerRequest, AnswerResult, Llm, TranscriptInput } from './llm.js';

const DECISION = /\b(we(?:'ve| have)? (?:decided|agreed)|decision is|let's go with|agreed\b)/i;
const COMMITMENT = /\b(I'll(?! start\b)|I will|I can take|action item)\b/i;
const DUE =
  /\b(by|before|on) ((?:next )?(?:monday|tuesday|wednesday|thursday|friday|end of (?:day|week|sprint))|\d{4}-\d{2}-\d{2})/i;

function firstSentence(text: string): string {
  return /^.*?[.!?](?=\s|$)/.exec(text)?.[0] ?? text;
}

function sentenceMatching(text: string, pattern: RegExp): string {
  return text.split(/(?<=[.!?])\s+/).find((s) => pattern.test(s)) ?? firstSentence(text);
}

function asTask(text: string): string {
  const task = firstSentence(text)
    .replace(COMMITMENT, '')
    .replace(/^[\s,:]+/, '')
    .replace(/[.!]$/, '');
  return task.charAt(0).toUpperCase() + task.slice(1);
}

function actionItem(u: Utterance) {
  return {
    owner: u.speaker,
    task: asTask(u.text.slice(u.text.search(COMMITMENT))),
    due: DUE.exec(u.text)?.[2] ?? null,
    atSec: u.start,
  };
}

function keywords(text: string): Set<string> {
  return new Set((text.toLowerCase().match(/[a-z0-9]{4,}/g) ?? []).filter((w) => w !== 'question'));
}

function bestLine(id: string, body: string, words: Set<string>) {
  let best: { id: string; time: string; speaker: string; text: string; score: number } | null =
    null;
  for (const m of body.matchAll(/^\[([\d:]+)\] ([^:\n]+): (.+)$/gm)) {
    const score = (m[3]!.toLowerCase().match(/[a-z0-9]{4,}/g) ?? []).filter((w) =>
      words.has(w),
    ).length;
    if (!best || score > best.score) {
      best = { id, time: m[1]!, speaker: m[2]!, text: m[3]!, score };
    }
  }
  return best;
}

export class FakeLlm implements Llm {
  readonly model = 'fake';

  async extractInsights({ preamble, utterances }: TranscriptInput): Promise<Insights> {
    const title = preamble.split('\n').find((l) => l.trim() && !/:/.test(l)) ?? 'Meeting';
    return {
      title: title
        .replace(/^#+\s*/, '')
        .replace(/,?\s*\d{4}-\d{2}-\d{2}$/, '')
        .trim(),
      occurredOn: /\d{4}-\d{2}-\d{2}/.exec(preamble)?.[0] ?? null,
      summary: utterances
        .filter((u) => u.text.split(/\s+/).length >= 12)
        .slice(0, 2)
        .map((u) => firstSentence(u.text))
        .join(' '),
      topics: [],
      decisions: utterances
        .filter((u) => DECISION.test(u.text))
        .map((u) => ({
          text: sentenceMatching(u.text, DECISION),
          madeBy: u.speaker,
          atSec: u.start,
        })),
      actionItems: utterances.filter((u) => COMMITMENT.test(u.text)).map(actionItem),
      openQuestions: [],
    };
  }

  async streamAnswer(
    request: AnswerRequest,
    onDelta: (text: string) => void,
  ): Promise<AnswerResult> {
    const last = request.messages.at(-1)?.content ?? '';
    const question = last.slice(last.lastIndexOf('Question:'));
    const sources = [...last.matchAll(/<source id="([^"]+)"[^>]*>\n([\s\S]*?)\n<\/source>/g)]
      .map(([, id, body]) => bestLine(id!, body!, keywords(question)))
      .filter((s) => s !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    const text = sources.length
      ? [
          'Here is what the transcripts say:',
          '',
          ...sources.map(
            (s) => `- **${s.speaker}** (${s.time}): ${firstSentence(s.text)} [${s.id}]`,
          ),
        ].join('\n')
      : 'I could not find anything relevant in these meetings.';
    for (const word of text.split(/(?<= )/)) onDelta(word);
    return {
      text,
      model: this.model,
      inputTokens: last.length,
      outputTokens: text.length,
      refused: false,
    };
  }
}
