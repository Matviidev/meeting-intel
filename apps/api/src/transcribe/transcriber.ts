import { z } from 'zod';

export interface Segment {
  start: number;
  end: number;
  text: string;
}

export interface Transcriber {
  readonly model: string;
  transcribe(audio: Buffer): Promise<Segment[]>;
}

export class EmptyRecordingError extends Error {}

export function splitSentences(segments: Segment[]): Segment[] {
  return segments.flatMap((segment) => {
    const parts = segment.text.split(/(?<=[.!?])\s+(?=[A-Z0-9"'])/).filter(Boolean);
    if (parts.length < 2) return [segment];
    const total = parts.reduce((n, p) => n + p.length, 0);
    const span = segment.end - segment.start;
    let at = segment.start;
    return parts.map((text) => {
      const start = at;
      at += (span * text.length) / total;
      return { start, end: at, text };
    });
  });
}

export const speakerTurnsSchema = z.object({
  turns: z
    .array(
      z.object({
        from: z.number().int().describe('Index of the first segment this person speaks'),
        speaker: z
          .string()
          .describe('First name if known from the conversation, else "Speaker A", "Speaker B", …'),
      }),
    )
    .describe('One entry each time the speaker changes, in segment order'),
});

export type SpeakerTurns = z.infer<typeof speakerTurnsSchema>;

const NAME = /^[A-Z][\w.'’-]*(?: [A-Z][\w.'’-]*){0,3}$/;

export function cleanSpeaker(raw: string): string | null {
  const name = raw
    .replace(/[^\p{L}\p{N} .'’-]/gu, '')
    .trim()
    .split(/\s+/)
    .slice(0, 4)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  return NAME.test(name) ? name : null;
}

export function assignSpeakers(count: number, { turns }: SpeakerTurns): string[] {
  const sorted = [...turns].sort((a, b) => a.from - b.from);
  const out: string[] = [];
  let current = 'Speaker A';
  let next = 0;
  for (let i = 0; i < count; i++) {
    while (next < sorted.length && sorted[next]!.from <= i) {
      current = cleanSpeaker(sorted[next]!.speaker) ?? current;
      next += 1;
    }
    out.push(current);
  }
  return out;
}
