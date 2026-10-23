import type { Segment, Transcriber } from './transcriber.js';

export class FakeTranscriber implements Transcriber {
  readonly model = 'fake';

  async transcribe(audio: Buffer): Promise<Segment[]> {
    return audio
      .toString('utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((text, i) => ({ start: i * 4, end: i * 4 + 3, text }));
  }
}
