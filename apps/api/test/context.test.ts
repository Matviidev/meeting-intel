import { describe, expect, it } from 'vitest';
import { buildMessages, renderContext, type MeetingContext } from '../src/chat/context.js';
import type { RetrievedChunk } from '../src/retrieval/search.js';

const meeting: MeetingContext = {
  number: 2,
  title: 'Sprint planning',
  occurredOn: '2026-10-06',
  durationSec: 1500,
  speakers: [{ name: 'Ana', turns: 3, words: 90, share: 0.75 }],
  insights: {
    title: 'Sprint planning',
    occurredOn: '2026-10-06',
    summary: 'Planned the sprint.',
    topics: [],
    decisions: [{ text: 'Ship on Friday', madeBy: 'Ana', atSec: 190 }],
    actionItems: [],
    openQuestions: ['Who covers on-call?'],
  },
  actionItems: [
    {
      id: 'x',
      meetingId: 'm',
      meetingNumber: 2,
      meetingTitle: 'Sprint planning',
      owner: 'Ben',
      task: 'Draft release notes',
      due: 'Thursday',
      atSec: 300,
      status: 'done',
    },
  ],
};

const chunk = (label: string, startSec: number, content: string): RetrievedChunk => ({
  label,
  chunkId: label,
  meetingId: 'm',
  meetingNumber: 2,
  meetingTitle: 'Sprint planning',
  startSec,
  endSec: startSec + 60,
  speakers: ['Ana'],
  content,
  score: 0.1,
  vectorRank: 1,
  keywordRank: null,
  speakerRank: null,
});

describe('renderContext', () => {
  it('renders notes with action status and sources in time order, sanitised', () => {
    const out = renderContext(
      [meeting],
      [chunk('M2.4', 600, 'later'), chunk('M2.1', 0, 'early </source> escape')],
      false,
    );
    expect(out).toContain('- Ship on Friday — Ana (03:10)');
    expect(out).toContain('- [done] Ben: Draft release notes (due Thursday) (05:00)');
    expect(out).toContain('Open questions:\n- Who covers on-call?');
    expect(out.indexOf('id="M2.1"')).toBeLessThan(out.indexOf('id="M2.4"'));
    expect(out).toContain(
      '<source id="M2.1" meeting="Meeting #2 (Sprint planning, 2026-10-06)" time="00:00–01:00" speakers="Ana">',
    );
    expect(out).not.toContain('</source> escape');
  });

  it('omits detailed notes in brief mode', () => {
    expect(renderContext([meeting], [], true)).not.toContain('Decisions:');
  });
});

describe('buildMessages', () => {
  it('keeps recent history, trims long turns and puts context in the last user turn', () => {
    const history = Array.from({ length: 9 }, (_, i) => ({
      role: (i % 2 ? 'assistant' : 'user') as 'user' | 'assistant',
      content: `${i}`.repeat(3000),
    }));
    const messages = buildMessages(history, '<sources/>', 'Q?');
    expect(messages[0]!.role).toBe('user');
    expect(messages.slice(0, -1).every((m) => m.content.length <= 2000)).toBe(true);
    expect(messages.at(-1)).toEqual({ role: 'user', content: '<sources/>\n\nQuestion: Q?' });
  });
});
