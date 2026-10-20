import { parseTimestamp } from '../ingest/time.js';

export class QuestionRejectedError extends Error {}

const INJECTION_PATTERNS = [
  /ignore (all |any |the )?(previous|prior|above|earlier) (instructions|prompts?|rules)/i,
  /disregard (the |your )?(system|previous) (prompt|instructions)/i,
  /(reveal|print|show|repeat) (me )?(your|the) (system )?(prompt|instructions)/i,
  /you are now (a|an|in) /i,
  /\bjailbreak\b|\bDAN mode\b|developer mode/i,
  /<\/?(system|sources|source|meeting_notes)\b/i,
];

const LABEL = String.raw`M\d+\.\d+`;
const CITATION_GROUP = new RegExp(String.raw`\[(${LABEL}(?:\s*,\s*${LABEL})*)\]`, 'g');
const ATTRIBUTION =
  /\b([A-Z][a-z’'-]+(?: [A-Z][a-z’'-]+)?)\s*\((?:at\s+)?(\d{1,2}:\d{2}(?::\d{2})?)\)/g;
const SOURCE_LINE = /^\[(\d{1,2}:\d{2}(?::\d{2})?)\] ([^:]+):/gm;
const ATTRIBUTION_TOLERANCE_SEC = 45;

export function validateQuestion(raw: string, maxChars: number): string {
  const question = raw.replace(/\s+/g, ' ').trim();
  if (!question) throw new QuestionRejectedError('Question is empty.');
  if (question.length > maxChars) {
    throw new QuestionRejectedError(`Question is too long (max ${maxChars} characters).`);
  }
  return question;
}

export function detectInjection(text: string): boolean {
  return INJECTION_PATTERNS.some((p) => p.test(text));
}

export function extractCitations(answer: string): string[] {
  const labels = new Set<string>();
  for (const group of answer.matchAll(CITATION_GROUP)) {
    for (const label of group[1]!.split(/\s*,\s*/)) labels.add(label);
  }
  return [...labels];
}

export function checkCitations(
  answer: string,
  allowed: string[],
): { cited: string[]; unknown: string[] } {
  const allowedSet = new Set(allowed);
  const cited = extractCitations(answer);
  return {
    cited: cited.filter((c) => allowedSet.has(c)),
    unknown: cited.filter((c) => !allowedSet.has(c)),
  };
}

export function checkAttributions(answer: string, sourceTexts: string[]): string[] {
  const lines = sourceTexts.flatMap((text) =>
    [...text.matchAll(SOURCE_LINE)].map((m) => ({
      sec: parseTimestamp(m[1]!),
      speaker: m[2]!.trim().toLowerCase(),
    })),
  );
  const unverified = new Set<string>();
  for (const m of answer.matchAll(ATTRIBUTION)) {
    const name = m[1]!.toLowerCase();
    const sec = parseTimestamp(m[2]!);
    if (sec === null) continue;
    const ok = lines.some(
      (l) =>
        l.sec !== null &&
        Math.abs(l.sec - sec) <= ATTRIBUTION_TOLERANCE_SEC &&
        (l.speaker === name || l.speaker.split(' ')[0] === name.split(' ')[0]),
    );
    if (!ok) unverified.add(`${m[1]} (${m[2]})`);
  }
  return [...unverified];
}

export function sanitizeSource(text: string): string {
  return text.replace(/<\/?(source|sources|system|meeting_notes)\b[^>]*>/gi, '');
}
