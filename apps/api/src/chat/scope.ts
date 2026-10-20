export interface MeetingRef {
  id: string;
  number: number;
  title: string;
  occurredOn: string | null;
}

export interface ResolvedScope {
  meetings: MeetingRef[];
  reason: 'pinned' | 'mentioned' | 'all';
  unknownNumbers: number[];
  speakers: string[];
}

const ORDINALS: Record<string, number> = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
};

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const MEETING_KINDS = [
  'kickoff',
  'kick-off',
  'retro',
  'retrospective',
  'standup',
  'stand-up',
  'planning',
  'review',
  'sync',
  'demo',
  'all-hands',
  'offsite',
  'postmortem',
  'post-mortem',
  'incident',
  'interview',
  'onboarding',
  'roadmap',
  'design',
];

const MEETING_NOUN = String.raw`(?:meeting|call|session|sync|transcript)`;

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasWord(haystack: string, word: string): boolean {
  return new RegExp(`(^|[^a-z0-9])${escape(word)}($|[^a-z0-9])`, 'i').test(haystack);
}

export function mentionedNumbers(question: string, maxNumber: number): number[] {
  const found = new Set<number>();
  for (const m of question.matchAll(
    new RegExp(String.raw`\b${MEETING_NOUN}s?\s*(?:#|no\.?|number)?\s*(\d{1,3})\b`, 'gi'),
  )) {
    found.add(Number(m[1]));
  }
  for (const m of question.matchAll(/(?:^|\s|\(|,)#(\d{1,3})\b/g)) found.add(Number(m[1]));
  for (const m of question.matchAll(/\b(?:and|&|or|vs\.?|versus)\s*#?(\d{1,3})\b/gi)) {
    if (found.size) found.add(Number(m[1]));
  }
  for (const m of question.matchAll(
    new RegExp(
      String.raw`\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|last|latest|most recent)\s+${MEETING_NOUN}\b`,
      'gi',
    ),
  )) {
    const word = m[1]!.toLowerCase();
    found.add(ORDINALS[word] ?? maxNumber);
  }
  return [...found].filter((n) => n > 0).sort((a, b) => a - b);
}

export function mentionedDates(question: string, year: number): string[] {
  const out = new Set<string>();
  for (const m of question.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) out.add(m[0]);
  const monthNames = String.raw`(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?`;
  const pad = (n: number) => String(n).padStart(2, '0');
  const add = (month: string, day: string) => {
    const mi = MONTHS.indexOf(month.slice(0, 3).toLowerCase());
    const d = Number(day);
    if (mi >= 0 && d >= 1 && d <= 31) out.add(`${year}-${pad(mi + 1)}-${pad(d)}`);
  };
  for (const m of question.matchAll(
    new RegExp(String.raw`\b${monthNames}\s+(\d{1,2})(?:st|nd|rd|th)?\b`, 'gi'),
  ))
    add(m[1]!, m[2]!);
  for (const m of question.matchAll(
    new RegExp(String.raw`\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?${monthNames}`, 'gi'),
  ))
    add(m[2]!, m[1]!);
  return [...out];
}

function namedMeetings(question: string, meetings: MeetingRef[]): number[] {
  const q = question.toLowerCase();
  const exact = meetings.filter((m) => m.title.length >= 8 && q.includes(m.title.toLowerCase()));
  if (exact.length) return exact.map((m) => m.number);
  const out: number[] = [];
  for (const kind of MEETING_KINDS) {
    if (!hasWord(q, kind)) continue;
    const titled = meetings.filter((m) => hasWord(m.title, kind));
    if (titled.length === 1) out.push(titled[0]!.number);
  }
  return out;
}

export function mentionedSpeakers(question: string, speakers: string[]): string[] {
  const firstNames = new Map<string, string[]>();
  for (const s of speakers) {
    const first = s.split(/\s+/)[0]!.toLowerCase();
    firstNames.set(first, [...(firstNames.get(first) ?? []), s]);
  }
  return speakers.filter((s) => {
    if (hasWord(question, s)) return true;
    const first = s.split(/\s+/)[0]!;
    return (
      first.length >= 3 &&
      firstNames.get(first.toLowerCase())?.length === 1 &&
      hasWord(question, first)
    );
  });
}

export function resolveScope(
  question: string,
  meetings: MeetingRef[],
  speakers: string[],
  pinned: number[] = [],
  year = new Date().getFullYear(),
): ResolvedScope {
  const byNumber = new Map(meetings.map((m) => [m.number, m]));
  const maxNumber = Math.max(0, ...meetings.map((m) => m.number));
  const who = mentionedSpeakers(question, speakers);

  const select = (numbers: number[], reason: ResolvedScope['reason']): ResolvedScope => ({
    meetings: numbers.flatMap((n) => byNumber.get(n) ?? []),
    reason,
    unknownNumbers: numbers.filter((n) => !byNumber.has(n)),
    speakers: who,
  });

  if (pinned.length) return select(pinned, 'pinned');

  const dates = new Set(mentionedDates(question, year));
  const mentioned = new Set([
    ...mentionedNumbers(question, maxNumber),
    ...namedMeetings(question, meetings),
    ...meetings.filter((m) => m.occurredOn && dates.has(m.occurredOn)).map((m) => m.number),
  ]);
  if (mentioned.size)
    return select(
      [...mentioned].sort((a, b) => a - b),
      'mentioned',
    );

  return { meetings, reason: 'all', unknownNumbers: [], speakers: who };
}
