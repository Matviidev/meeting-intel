import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { insightsSchema, type Insights } from '../domain/meeting.js';
import { formatTime } from '../ingest/time.js';
import { renderUtterance } from '../ingest/transcript.js';
import { assignSpeakers, speakerTurnsSchema, type Segment } from '../transcribe/transcriber.js';
import {
  ExtractionError,
  type AnswerRequest,
  type AnswerResult,
  type Llm,
  type TranscriptInput,
} from './llm.js';
import { EXTRACTION_PROMPT, SPEAKER_PROMPT } from './prompts.js';

type Effort = 'low' | 'medium' | 'high';

const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

export interface AnthropicLlmOptions {
  apiKey?: string;
  model: string;
  extractionEffort: Effort;
  chatEffort: Effort;
}

export class AnthropicLlm implements Llm {
  readonly model: string;
  private readonly client: Anthropic;

  constructor(private readonly options: AnthropicLlmOptions) {
    this.model = options.model;
    this.client = new Anthropic({ apiKey: options.apiKey, maxRetries: 3, timeout: 180_000 });
  }

  async extractInsights({ preamble, utterances }: TranscriptInput): Promise<Insights> {
    const transcript = utterances.map((u) => renderUtterance(u, formatTime)).join('\n');
    const header = preamble ? `<header>\n${preamble}\n</header>\n` : '';
    const response = await this.client.beta.messages.parse({
      model: this.model,
      max_tokens: 16000,
      betas: [FALLBACK_BETA],
      fallbacks: 'default',
      output_config: {
        effort: this.options.extractionEffort,
        format: betaZodOutputFormat(insightsSchema),
      },
      system: EXTRACTION_PROMPT,
      messages: [{ role: 'user', content: `${header}<transcript>\n${transcript}\n</transcript>` }],
    });
    if (response.stop_reason === 'refusal' || !response.parsed_output) {
      throw new ExtractionError(`Could not extract insights (stop_reason=${response.stop_reason})`);
    }
    return response.parsed_output;
  }

  async labelSpeakers(segments: Segment[]): Promise<string[]> {
    const lines = segments.map((s, i) => `${i} [${formatTime(s.start)}] ${s.text}`).join('\n');
    const response = await this.client.beta.messages.parse({
      model: this.model,
      max_tokens: 16000,
      betas: [FALLBACK_BETA],
      fallbacks: 'default',
      output_config: {
        effort: this.options.extractionEffort,
        format: betaZodOutputFormat(speakerTurnsSchema),
      },
      system: SPEAKER_PROMPT,
      messages: [{ role: 'user', content: `<segments>\n${lines}\n</segments>` }],
    });
    if (response.stop_reason === 'refusal' || !response.parsed_output) {
      throw new ExtractionError(`Could not label speakers (stop_reason=${response.stop_reason})`);
    }
    return assignSpeakers(segments.length, response.parsed_output);
  }

  async streamAnswer(
    request: AnswerRequest,
    onDelta: (text: string) => void,
  ): Promise<AnswerResult> {
    const stream = this.client.beta.messages.stream(
      {
        model: this.model,
        max_tokens: 8000,
        betas: [FALLBACK_BETA],
        fallbacks: 'default',
        output_config: { effort: this.options.chatEffort },
        system: [{ type: 'text', text: request.system, cache_control: { type: 'ephemeral' } }],
        messages: request.messages,
      },
      { signal: request.signal },
    );

    stream.on('text', (delta) => onDelta(delta));
    const message = await stream.finalMessage();
    const text = message.content
      .flatMap((block) => (block.type === 'text' ? [block.text] : []))
      .join('');

    return {
      text,
      model: message.model,
      inputTokens: message.usage.input_tokens + (message.usage.cache_read_input_tokens ?? 0),
      outputTokens: message.usage.output_tokens,
      refused: message.stop_reason === 'refusal',
    };
  }
}
