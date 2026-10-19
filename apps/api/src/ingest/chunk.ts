import type { Utterance } from '../domain/meeting.js';
import { formatTime } from './time.js';
import { renderUtterance } from './transcript.js';

export interface Chunk {
  ordinal: number;
  startSec: number;
  endSec: number;
  speakers: string[];
  content: string;
}

export interface ChunkOptions {
  maxChars: number;
  overlapMaxChars: number;
}

const DEFAULTS: ChunkOptions = { maxChars: 1000, overlapMaxChars: 280 };

function splitLongUtterance(u: Utterance, maxChars: number): Utterance[] {
  const line = renderUtterance(u, formatTime);
  if (line.length <= maxChars) return [u];
  const budget = maxChars - (line.length - u.text.length);
  const parts: string[] = [];
  let current = '';
  for (const sentence of u.text.split(/(?<=[.!?])\s+/)) {
    if (current && current.length + sentence.length + 1 > budget) {
      parts.push(current);
      current = '';
    }
    current = current ? `${current} ${sentence}` : sentence;
    while (current.length > budget) {
      parts.push(current.slice(0, budget));
      current = current.slice(budget);
    }
  }
  if (current) parts.push(current);
  return parts.map((text) => ({ ...u, text }));
}

export function chunkTranscript(
  utterances: Utterance[],
  durationSec: number,
  options: Partial<ChunkOptions> = {},
): Chunk[] {
  const opts = { ...DEFAULTS, ...options };
  const units = utterances.flatMap((u) => splitLongUtterance(u, opts.maxChars));
  const groups: Utterance[][] = [];
  let current: Utterance[] = [];
  let size = 0;

  for (const unit of units) {
    const line = renderUtterance(unit, formatTime);
    if (current.length && size + line.length + 1 > opts.maxChars) {
      groups.push(current);
      const tail = current.at(-1)!;
      const tailLine = renderUtterance(tail, formatTime);
      const carry = tailLine.length <= opts.overlapMaxChars && current.length > 1;
      current = carry ? [tail] : [];
      size = carry ? tailLine.length + 1 : 0;
    }
    current.push(unit);
    size += line.length + 1;
  }
  if (current.length) groups.push(current);

  return groups.map((group, ordinal) => {
    const next = groups[ordinal + 1]?.find((u) => !group.includes(u));
    return {
      ordinal,
      startSec: group[0]!.start,
      endSec: Math.max(group.at(-1)!.start, next?.start ?? durationSec),
      speakers: [...new Set(group.map((u) => u.speaker))],
      content: group.map((u) => renderUtterance(u, formatTime)).join('\n'),
    };
  });
}
