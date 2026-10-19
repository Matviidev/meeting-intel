import { describe, expect, it } from 'vitest';
import type { Utterance } from '../src/domain/meeting.js';
import { chunkTranscript } from '../src/ingest/chunk.js';

const turn = (index: number, start: number, speaker: string, text: string): Utterance => ({
  index,
  start,
  speaker,
  text,
});

describe('chunkTranscript', () => {
  it('keeps short transcripts in one chunk with time range and speakers', () => {
    const chunks = chunkTranscript([turn(0, 5, 'Ana', 'Hello'), turn(1, 30, 'Ben', 'Hi')], 60);
    expect(chunks).toEqual([
      {
        ordinal: 0,
        startSec: 5,
        endSec: 60,
        speakers: ['Ana', 'Ben'],
        content: '[00:05] Ana: Hello\n[00:30] Ben: Hi',
      },
    ]);
  });

  it('never splits an utterance across chunks and overlaps one short turn', () => {
    const utterances = Array.from({ length: 12 }, (_, i) =>
      turn(i, i * 20, i % 2 ? 'Ben' : 'Ana', `Point number ${i} `.repeat(6).trim()),
    );
    const chunks = chunkTranscript(utterances, 300, { maxChars: 400 });
    expect(chunks.length).toBeGreaterThan(2);
    for (const c of chunks) expect(c.content.length).toBeLessThanOrEqual(400);
    for (let i = 1; i < chunks.length; i++) {
      const prevLast = chunks[i - 1]!.content.split('\n').at(-1);
      expect(chunks[i]!.content.split('\n')[0]).toBe(prevLast);
    }
    const all = new Set(chunks.flatMap((c) => c.content.split('\n')));
    expect(all.size).toBe(12);
  });

  it('ends a chunk where the next new turn starts', () => {
    const utterances = [
      turn(0, 0, 'Ana', 'a'.repeat(150)),
      turn(1, 40, 'Ben', 'b'.repeat(150)),
      turn(2, 90, 'Ana', 'c'.repeat(150)),
    ];
    const [first, second] = chunkTranscript(utterances, 120, {
      maxChars: 340,
      overlapMaxChars: 0,
    });
    expect(first).toMatchObject({ startSec: 0, endSec: 90 });
    expect(second).toMatchObject({ startSec: 90, endSec: 120 });
  });

  it('splits a monologue longer than the chunk size on sentences', () => {
    const text = Array.from({ length: 30 }, (_, i) => `Sentence ${i} is here.`).join(' ');
    const chunks = chunkTranscript([turn(0, 0, 'Ana', text)], 100, { maxChars: 200 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c.content.length).toBeLessThanOrEqual(200);
      expect(c.content.startsWith('[00:00] Ana: ')).toBe(true);
    }
  });
});
