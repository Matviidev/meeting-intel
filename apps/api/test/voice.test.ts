import { execFileSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import { parseTranscript } from '../src/ingest/transcript.js';
import { FakeLlm } from '../src/llm/fake.js';
import { AudioDecodeError, decodeAudio, isAudioFile } from '../src/transcribe/audio.js';
import { renderTranscript, titleFromFilename } from '../src/transcribe/render.js';
import { assignSpeakers, cleanSpeaker, splitSentences } from '../src/transcribe/transcriber.js';
import { createTestApp } from './helpers.js';

const hasFfmpeg = (() => {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

function wav(seconds: number, rate = 8000): Buffer {
  const samples = seconds * rate;
  const buf = Buffer.alloc(44 + samples * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + samples * 2, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) {
    buf.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / rate) * 8000), 44 + i * 2);
  }
  return buf;
}

const segments = [
  { start: 0, end: 2.6, text: "Okay, let's start the design sync." },
  { start: 2.6, end: 6.2, text: 'Tom, where does onboarding stand?' },
  { start: 6.3, end: 9.7, text: 'The new screens are done and we decided to drop the phone step.' },
  { start: 9.7, end: 12.4, text: "I'll send the final mockups by Friday." },
];

describe('speaker labels', () => {
  it('expands speaker turns to every segment', () => {
    const speakers = assignSpeakers(4, {
      turns: [
        { from: 2, speaker: 'tom' },
        { from: 0, speaker: 'Priya' },
      ],
    });
    expect(speakers).toEqual(['Priya', 'Priya', 'Tom', 'Tom']);
  });

  it('keeps the previous speaker when a label is unusable', () => {
    expect(cleanSpeaker('  speaker b ')).toBe('Speaker B');
    expect(cleanSpeaker('???')).toBeNull();
    const speakers = assignSpeakers(3, {
      turns: [
        { from: 0, speaker: 'Ana' },
        { from: 1, speaker: '42' },
      ],
    });
    expect(speakers).toEqual(['Ana', 'Ana', 'Ana']);
  });

  it('alternates speakers after questions in the fake model', async () => {
    expect(await new FakeLlm().labelSpeakers(segments)).toEqual([
      'Speaker A',
      'Speaker A',
      'Speaker B',
      'Speaker B',
    ]);
  });
});

describe('sentence splitting', () => {
  it('splits long segments and spreads their time by length', () => {
    const parts = splitSentences([
      { start: 10, end: 20, text: 'Thanks, Tom here. Did it ship? Yes.' },
      { start: 20, end: 22, text: 'e.g. not split here' },
    ]);
    expect(parts.map((p) => p.text)).toEqual([
      'Thanks, Tom here.',
      'Did it ship?',
      'Yes.',
      'e.g. not split here',
    ]);
    expect(parts[0]!.start).toBe(10);
    expect(parts[1]!.start).toBeCloseTo(15.15, 1);
    expect(parts[2]!.end).toBe(20);
  });
});

describe('rendered transcripts', () => {
  it('derives a title from the file name', () => {
    expect(titleFromFilename('04-design_sync.m4a')).toBe('Design sync');
    expect(titleFromFilename('.webm')).toBe('Recorded meeting');
  });

  it('produces a transcript the parser accepts', () => {
    const text = renderTranscript('design-sync.mp3', segments, ['Priya', 'Priya', 'Tom', 'Tom']);
    const { preamble, utterances } = parseTranscript(text);
    expect(preamble).toContain('# Design sync');
    expect(utterances.map((u) => [u.start, u.speaker])).toEqual([
      [0, 'Priya'],
      [6, 'Tom'],
    ]);
  });
});

describe('audio decoding', () => {
  it('recognises audio files by extension', () => {
    expect(isAudioFile('call.MP3')).toBe(true);
    expect(isAudioFile('recording.webm')).toBe(true);
    expect(isAudioFile('notes.txt')).toBe(false);
  });

  it.skipIf(!hasFfmpeg)('decodes to 16 kHz mono samples', async () => {
    const samples = await decodeAudio(wav(1));
    expect(samples.length).toBeGreaterThan(15_000);
    expect(samples.length).toBeLessThan(17_000);
    expect(Math.max(...samples.slice(0, 1000))).toBeGreaterThan(0.1);
  });

  it.skipIf(!hasFfmpeg)('rejects files that are not audio', async () => {
    await expect(decodeAudio(Buffer.from('not audio at all'))).rejects.toBeInstanceOf(
      AudioDecodeError,
    );
  });
});

function multipart(filename: string, content: string) {
  const boundary = '----voice-boundary';
  const payload = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="file"; filename="${filename}"`,
    'Content-Type: application/octet-stream',
    '',
    content,
    `--${boundary}--`,
    '',
  ].join('\r\n');
  return { payload, headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } };
}

describe('audio uploads', () => {
  let close: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await close?.();
  });

  it('transcribes audio, labels speakers and ingests the meeting', async () => {
    const ctx = await createTestApp();
    close = ctx.close;
    const spoken = [
      "Okay, let's start the design sync for the onboarding flow this week.",
      'Tom, where does the onboarding flow stand right now?',
      'The new screens are done and we have decided to drop the phone number step.',
      "I'll send the final mockups to the team by Friday.",
    ].join('\n');
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/meetings',
      ...multipart('design-sync.mp3', spoken),
    });
    expect(res.statusCode).toBe(201);
    const { meeting } = res.json();
    expect(meeting.title).toBe('Design sync');
    expect(meeting.sourceName).toBe('design-sync.mp3');
    expect(meeting.speakers.map((s: { name: string }) => s.name).sort()).toEqual([
      'Speaker A',
      'Speaker B',
    ]);
    expect(meeting.openActionCount).toBe(1);
    const metrics = await ctx.app.inject({ url: '/metrics' });
    expect(metrics.body).toContain('transcribe_duration_seconds_count 1');
  });

  it('rejects recordings without enough speech', async () => {
    const ctx = await createTestApp();
    close = ctx.close;
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/meetings',
      ...multipart('silence.wav', 'hello'),
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error).toBe('invalid_audio');
  });

  it('refuses audio when transcription is off', async () => {
    const ctx = await createTestApp(new FakeLlm(), null);
    close = ctx.close;
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/meetings',
      ...multipart('call.m4a', 'one\ntwo'),
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().message).toMatch(/turned off/);
  });
});
