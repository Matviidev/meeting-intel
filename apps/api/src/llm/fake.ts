import type { Insights, Utterance } from '../domain/meeting.js';
import type { AnswerRequest, AnswerResult, Llm, TranscriptInput } from './llm.js';

const DECISION = /\b(we(?:'ve| have)? (?:decided|agreed)|decision is|let's go with|agreed\b)/i;
const COMMITMENT = /\b(I'll|I will|I can take|action item)\b/i;
const DUE =
  /\b(by|before|on) ((?:next )?(?:monday|tuesday|wednesday|thursday|friday|end of (?:day|week|sprint))|\d{4}-\d{2}-\d{2})/i;

function firstSentence(text: string): string {
  return /^.*?[.!?](?=\s|$)/.exec(text)?.[0] ?? text;
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
        .slice(0, 2)
        .map((u) => firstSentence(u.text))
        .join(' '),
      topics: [],
      decisions: utterances
        .filter((u) => DECISION.test(u.text))
        .map((u) => ({ text: firstSentence(u.text), madeBy: u.speaker, atSec: u.start })),
      actionItems: utterances.filter((u) => COMMITMENT.test(u.text)).map(actionItem),
      openQuestions: [],
    };
  }

  async streamAnswer(
    request: AnswerRequest,
    onDelta: (text: string) => void,
  ): Promise<AnswerResult> {
    const last = request.messages.at(-1)?.content ?? '';
    const sources = [
      ...last.matchAll(/<source id="([^"]+)"[^>]*>\n\[([\d:]+)\] ([^:\n]+): ([^\n]+)/g),
    ].slice(0, 3);
    const text = sources.length
      ? [
          'Here is what the transcripts say:',
          '',
          ...sources.map(
            ([, id, time, speaker, line]) =>
              `- **${speaker}** (${time}): ${firstSentence(line!)} [${id}]`,
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
