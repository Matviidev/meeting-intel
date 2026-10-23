import { formatTime } from '../ingest/time.js';
import type { Segment } from './transcriber.js';

export function titleFromFilename(filename: string): string {
  const base = filename
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/^\d+\s+/, '')
    .trim();
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : 'Recorded meeting';
}

export function renderTranscript(
  filename: string,
  segments: Segment[],
  speakers: string[],
): string {
  const lines = segments.map(
    (s, i) => `[${formatTime(s.start)}] ${speakers[i] ?? 'Speaker A'}: ${s.text}`,
  );
  return [
    `# ${titleFromFilename(filename)}`,
    `Transcribed from audio (${filename}). Speaker names are inferred from the conversation.`,
    '',
    ...lines,
  ].join('\n');
}
