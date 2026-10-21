import { describe, expect, it } from 'vitest';
import { formatTime, parseTimestamp } from '../src/ingest/time.js';
import {
  InvalidTranscriptError,
  UnsupportedFileError,
  estimateDuration,
  parseTranscript,
  readTranscriptFile,
  speakerStats,
} from '../src/ingest/transcript.js';

describe('timestamps', () => {
  it.each([
    ['00:01:23', 83],
    ['1:02:03', 3723],
    ['04:05', 245],
    ['00:00:07.250', 7],
    ['00:00:07,250', 7],
  ])('parses %s', (raw, sec) => expect(parseTimestamp(raw)).toBe(sec));

  it('rejects invalid values', () => {
    expect(parseTimestamp('12:75')).toBeNull();
    expect(parseTimestamp('noon')).toBeNull();
  });

  it('formats short and long times', () => {
    expect(formatTime(83)).toBe('01:23');
    expect(formatTime(3723)).toBe('1:02:03');
  });
});

describe('parseTranscript', () => {
  it('reads bracketed timestamp lines and keeps the preamble', () => {
    const { preamble, utterances } = parseTranscript(
      [
        'Sprint planning',
        'Date: 2026-10-03',
        '[00:00:05] Priya Shah: Morning all.',
        'Let us start with the backlog.',
        '[00:00:20] Tom: Sounds good.',
      ].join('\n'),
    );
    expect(preamble).toBe('Sprint planning\nDate: 2026-10-03');
    expect(utterances).toEqual([
      {
        index: 0,
        start: 5,
        speaker: 'Priya Shah',
        text: 'Morning all. Let us start with the backlog.',
      },
      { index: 1, start: 20, speaker: 'Tom', text: 'Sounds good.' },
    ]);
  });

  it('reads speaker-first and header-line formats', () => {
    const a = parseTranscript('Alice (00:10): Hi\nBob [00:15]: Hey');
    expect(a.utterances.map((u) => [u.speaker, u.start])).toEqual([
      ['Alice', 10],
      ['Bob', 15],
    ]);
    const b = parseTranscript('Alice 0:10\nHi there\n\nBob 0:42\nHello');
    expect(b.utterances.map((u) => [u.speaker, u.start, u.text])).toEqual([
      ['Alice', 10, 'Hi there'],
      ['Bob', 42, 'Hello'],
    ]);
  });

  it('reads WebVTT voice tags and merges consecutive cues from one speaker', () => {
    const vtt = [
      'WEBVTT',
      'NOTE Release sync, 2026-10-06',
      '',
      '00:00:01.000 --> 00:00:03.000',
      '<v Alice>We should ship Friday.</v>',
      '',
      '00:00:03.500 --> 00:00:05.000',
      '<v Alice>If QA signs off.</v>',
      '',
      '00:00:06.000 --> 00:00:08.000',
      '<v Bob>Agreed.</v>',
    ].join('\n');
    expect(parseTranscript(vtt).preamble).toBe('Release sync, 2026-10-06');
    expect(parseTranscript(vtt).utterances).toEqual([
      { index: 0, start: 1, speaker: 'Alice', text: 'We should ship Friday. If QA signs off.' },
      { index: 1, start: 6, speaker: 'Bob', text: 'Agreed.' },
    ]);
  });

  it('reads SRT with inline speakers', () => {
    const srt =
      '1\n00:00:01,000 --> 00:00:02,000\nAlice: One\n\n2\n00:00:40,000 --> 00:00:41,000\nBob: Two';
    expect(parseTranscript(srt).utterances.map((u) => u.speaker)).toEqual(['Alice', 'Bob']);
  });

  it('rejects text without timestamped speaker lines', () => {
    expect(() => parseTranscript('Just some meeting notes.\nNothing else.')).toThrow(
      InvalidTranscriptError,
    );
  });
});

describe('readTranscriptFile', () => {
  it('rejects unsupported extensions', () => {
    expect(() => readTranscriptFile('notes.pdf', Buffer.from('x'))).toThrow(UnsupportedFileError);
  });

  it('normalises line endings and BOM', () => {
    expect(readTranscriptFile('a.txt', Buffer.from('﻿a\r\nb'))).toBe('a\nb');
  });
});

describe('speakerStats', () => {
  it('computes turns, words and share sorted by words', () => {
    const { utterances } = parseTranscript(
      '[00:00] A: one two three\n[00:10] B: four\n[00:40] A: five six',
    );
    expect(speakerStats(utterances)).toEqual([
      { name: 'A', turns: 2, words: 5, share: 0.833 },
      { name: 'B', turns: 1, words: 1, share: 0.167 },
    ]);
    expect(estimateDuration(utterances)).toBe(41);
  });
});
