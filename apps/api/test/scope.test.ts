import { describe, expect, it } from 'vitest';
import {
  mentionedDates,
  mentionedNumbers,
  mentionedSpeakers,
  resolveScope,
  type MeetingRef,
} from '../src/chat/scope.js';

const meetings: MeetingRef[] = [
  { id: 'a', number: 1, title: 'Checkout redesign kickoff', occurredOn: '2026-09-29' },
  { id: 'b', number: 2, title: 'Sprint 14 planning', occurredOn: '2026-10-06' },
  { id: 'c', number: 3, title: 'Checkout launch retro', occurredOn: '2026-10-20' },
];
const speakers = ['Priya Shah', 'Tom Becker', 'Lena Ortiz', 'Tom Ruiz'];

const numbers = (q: string) =>
  resolveScope(q, meetings, speakers, [], 2026).meetings.map((m) => m.number);

describe('mentionedNumbers', () => {
  it.each([
    ['What did we decide in meeting #2?', [2]],
    ['Compare meeting 1 and 3', [1, 3]],
    ['Summarise the call #3', [3]],
    ['What happened in the last meeting?', [3]],
    ['and in the second session?', [2]],
    ['Anything about version 2 of the API?', []],
  ])('%s', (q, expected) => expect(mentionedNumbers(q, 3)).toEqual(expected));
});

describe('mentionedDates', () => {
  it('reads ISO and spoken dates', () => {
    expect(mentionedDates('on 2026-10-06 or Oct 20th or 29 September', 2026).sort()).toEqual([
      '2026-09-29',
      '2026-10-06',
      '2026-10-20',
    ]);
  });
});

describe('mentionedSpeakers', () => {
  it('matches full names and unique first names only', () => {
    expect(mentionedSpeakers('What did Priya and Lena Ortiz commit to?', speakers)).toEqual([
      'Priya Shah',
      'Lena Ortiz',
    ]);
    expect(mentionedSpeakers('What did Tom say?', speakers)).toEqual([]);
    expect(mentionedSpeakers('What did Tom Ruiz say?', speakers)).toEqual(['Tom Ruiz']);
  });
});

describe('resolveScope', () => {
  it('prefers pinned meetings and reports unknown numbers', () => {
    const scope = resolveScope('meeting #1', meetings, speakers, [2, 9]);
    expect(scope.reason).toBe('pinned');
    expect(scope.meetings.map((m) => m.number)).toEqual([2]);
    expect(scope.unknownNumbers).toEqual([9]);
  });

  it('resolves meeting kinds only when one title matches', () => {
    expect(numbers('What came out of the retro?')).toEqual([3]);
    expect(numbers('In the kickoff, who owned design?')).toEqual([1]);
    expect(numbers('What did we say about checkout?')).toEqual([1, 2, 3]);
  });

  it('resolves dates and full titles', () => {
    expect(numbers('What was agreed on October 6?')).toEqual([2]);
    expect(numbers('Recap sprint 14 planning please')).toEqual([2]);
  });

  it('falls back to all meetings and still reports speakers', () => {
    const scope = resolveScope('What is Lena working on?', meetings, speakers, [], 2026);
    expect(scope.reason).toBe('all');
    expect(scope.speakers).toEqual(['Lena Ortiz']);
  });
});
