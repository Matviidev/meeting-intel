import {
  env,
  pipeline,
  type AutomaticSpeechRecognitionOutput,
  type AutomaticSpeechRecognitionPipeline,
} from '@huggingface/transformers';
import { decodeAudio } from './audio.js';
import type { Segment, Transcriber } from './transcriber.js';

export class WhisperTranscriber implements Transcriber {
  private asr?: Promise<AutomaticSpeechRecognitionPipeline>;

  constructor(
    readonly model: string,
    cacheDir: string,
  ) {
    env.cacheDir = cacheDir;
  }

  warmup(): Promise<unknown> {
    return this.load();
  }

  async transcribe(audio: Buffer): Promise<Segment[]> {
    const samples = await decodeAudio(audio);
    const asr = await this.load();
    const output = (await asr(samples, {
      return_timestamps: true,
      chunk_length_s: 30,
      stride_length_s: 5,
    })) as AutomaticSpeechRecognitionOutput;
    return (output.chunks ?? []).flatMap((chunk) => {
      const text = chunk.text.trim();
      const [start, end] = chunk.timestamp;
      return text ? [{ start, end: end ?? start, text }] : [];
    });
  }

  private load(): Promise<AutomaticSpeechRecognitionPipeline> {
    this.asr ??= pipeline('automatic-speech-recognition', this.model, {
      dtype: 'q8',
    }) as Promise<AutomaticSpeechRecognitionPipeline>;
    return this.asr;
  }
}
