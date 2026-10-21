import type { SpeakerStat, Utterance } from '../domain/meeting.js';
import { parseTimestamp } from './time.js';

export class UnsupportedFileError extends Error {}
export class InvalidTranscriptError extends Error {}

export interface ParsedTranscript {
  preamble: string;
  utterances: Utterance[];
}

const TEXT_EXTENSIONS = ['.txt', '.md', '.vtt', '.srt'];
const TS = String.raw`\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?`;
const SPEAKER = String.raw`[A-Z][\w.'’-]*(?: [A-Z][\w.'’-]*){0,3}`;

const LINE_FORMATS: RegExp[] = [
  new RegExp(String.raw`^\[?(${TS})\]?\s*[-–—]?\s*(${SPEAKER})\s*:\s*(.*)$`),
  new RegExp(String.raw`^(${SPEAKER})\s*[[(](${TS})[\])]\s*:?\s*(.*)$`),
];
const HEADER_ONLY = new RegExp(String.raw`^(${SPEAKER})\s+(${TS})$`);
const CUE_TIMING = new RegExp(String.raw`^(${TS})\s*-->\s*(${TS})`);
const VOICE_TAG = /^<v(?:\.[\w.]+)?\s+([^>]+)>(.*?)(?:<\/v>)?$/;
const INLINE_SPEAKER = new RegExp(String.raw`^(${SPEAKER})\s*:\s*(.*)$`);

export function readTranscriptFile(filename: string, buffer: Buffer): string {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  if (!TEXT_EXTENSIONS.includes(ext)) {
    throw new UnsupportedFileError(`Unsupported file type "${ext}". Use TXT, MD, VTT or SRT.`);
  }
  return normalizeText(buffer.toString('utf8'));
}

export function normalizeText(text: string): string {
  return text
    .replace(/^﻿/, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .replace(/ +\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function parseTranscript(text: string): ParsedTranscript {
  const parsed = /-->/.test(text) ? parseCues(text) : parseLines(text);
  const utterances = mergeTurns(parsed.utterances).map((u, index) => ({ ...u, index }));
  if (utterances.length < 2) {
    throw new InvalidTranscriptError(
      'No speaker-labelled, timestamped lines found. Expected lines like "[00:01:23] Alice: …".',
    );
  }
  return { preamble: parsed.preamble, utterances };
}

function parseLines(text: string): ParsedTranscript {
  const preamble: string[] = [];
  const out: Utterance[] = [];
  let pendingHeader: { speaker: string; start: number } | null = null;

  for (const raw of text.split('\n')) {
    const line = raw.trim().replace(/^[*_]+|[*_]+$/g, '');
    if (!line) continue;

    const header = HEADER_ONLY.exec(line);
    if (header && parseTimestamp(header[2]!) !== null) {
      pendingHeader = { speaker: header[1]!, start: parseTimestamp(header[2]!)! };
      continue;
    }

    const turn = matchLine(line);
    if (turn) {
      pendingHeader = null;
      out.push({ index: 0, ...turn });
      continue;
    }

    if (pendingHeader) {
      out.push({ index: 0, ...pendingHeader, text: line });
      pendingHeader = null;
    } else if (out.length) {
      out.at(-1)!.text += ` ${line}`;
    } else {
      preamble.push(raw.trim());
    }
  }
  return { preamble: preamble.join('\n'), utterances: out };
}

function matchLine(line: string): Omit<Utterance, 'index'> | null {
  const [tsFirst, speakerFirst] = LINE_FORMATS;
  const a = tsFirst!.exec(line);
  if (a) {
    const start = parseTimestamp(a[1]!);
    if (start !== null) return { start, speaker: a[2]!, text: a[3]!.trim() };
  }
  const b = speakerFirst!.exec(line);
  if (b) {
    const start = parseTimestamp(b[2]!);
    if (start !== null) return { start, speaker: b[1]!, text: b[3]!.trim() };
  }
  return null;
}

function parseCues(text: string): ParsedTranscript {
  const out: Utterance[] = [];
  const preamble: string[] = [];
  for (const block of text.split(/\n\s*\n/)) {
    const lines = block.split('\n').map((l) => l.trim());
    const timingAt = lines.findIndex((l) => CUE_TIMING.test(l));
    if (timingAt < 0) {
      if (!out.length) preamble.push(...lines.map(cueHeader).filter(Boolean));
      continue;
    }
    const start = parseTimestamp(CUE_TIMING.exec(lines[timingAt]!)![1]!);
    if (start === null) continue;
    const body = lines.slice(timingAt + 1).filter(Boolean);
    if (!body.length) continue;

    let speaker = out.at(-1)?.speaker ?? 'Unknown';
    const first = body[0]!;
    const voice = VOICE_TAG.exec(first);
    const inline = INLINE_SPEAKER.exec(first);
    if (voice) {
      speaker = voice[1]!.trim();
      body[0] = voice[2]!;
    } else if (inline) {
      speaker = inline[1]!;
      body[0] = inline[2]!;
    }
    const textBody = body
      .join(' ')
      .replace(/<[^>]+>/g, '')
      .trim();
    if (textBody) out.push({ index: 0, start, speaker, text: textBody });
  }
  return { preamble: preamble.join('\n'), utterances: out };
}

function cueHeader(line: string): string {
  return line
    .replace(/^WEBVTT\b.*$/, '')
    .replace(/^NOTE\s*/, '')
    .trim();
}

function mergeTurns(utterances: Utterance[]): Utterance[] {
  const out: Utterance[] = [];
  for (const u of utterances) {
    const prev = out.at(-1);
    if (prev && prev.speaker === u.speaker && u.start - prev.start < 30) {
      prev.text += ` ${u.text}`;
    } else if (u.text) {
      out.push({ ...u });
    }
  }
  return out;
}

export function speakerStats(utterances: Utterance[]): SpeakerStat[] {
  const byName = new Map<string, { turns: number; words: number }>();
  for (const u of utterances) {
    const s = byName.get(u.speaker) ?? { turns: 0, words: 0 };
    s.turns += 1;
    s.words += u.text.split(/\s+/).filter(Boolean).length;
    byName.set(u.speaker, s);
  }
  const total = [...byName.values()].reduce((n, s) => n + s.words, 0) || 1;
  return [...byName.entries()]
    .map(([name, s]) => ({ name, ...s, share: Math.round((s.words / total) * 1000) / 1000 }))
    .sort((a, b) => b.words - a.words);
}

export function estimateDuration(utterances: Utterance[]): number {
  const last = utterances.at(-1);
  if (!last) return 0;
  const words = last.text.split(/\s+/).length;
  return last.start + Math.ceil(words / 2.5);
}

export function renderUtterance(u: Utterance, format: (sec: number) => string): string {
  return `[${format(u.start)}] ${u.speaker}: ${u.text}`;
}
