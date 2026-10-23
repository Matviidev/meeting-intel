import type { Llm } from '../llm/llm.js';
import { renderTranscript } from './render.js';
import { EmptyRecordingError, splitSentences, type Transcriber } from './transcriber.js';

export class TranscriptionService {
  constructor(
    private readonly transcriber: Transcriber,
    private readonly llm: Llm,
  ) {}

  async toTranscript(filename: string, audio: Buffer): Promise<string> {
    const segments = splitSentences(await this.transcriber.transcribe(audio));
    if (segments.length < 2) {
      throw new EmptyRecordingError('Not enough speech found in the recording to transcribe.');
    }
    const speakers = await this.llm.labelSpeakers(segments);
    return renderTranscript(filename, segments, speakers);
  }
}
