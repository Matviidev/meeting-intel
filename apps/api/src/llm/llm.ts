import type { Insights, Utterance } from '../domain/meeting.js';
import type { Segment } from '../transcribe/transcriber.js';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AnswerRequest {
  system: string;
  messages: ChatTurn[];
  signal?: AbortSignal;
}

export interface AnswerResult {
  text: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  refused: boolean;
}

export interface TranscriptInput {
  preamble: string;
  utterances: Utterance[];
}

export interface Llm {
  readonly model: string;
  extractInsights(transcript: TranscriptInput): Promise<Insights>;
  streamAnswer(request: AnswerRequest, onDelta: (text: string) => void): Promise<AnswerResult>;
  labelSpeakers(segments: Segment[]): Promise<string[]>;
}

export class ExtractionError extends Error {}
