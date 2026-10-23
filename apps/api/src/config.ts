import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(3000),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.string().default('info'),
  DATABASE_URL: z.string().default('postgres://quorum:quorum@localhost:5432/quorum'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  LLM_PROVIDER: z.enum(['anthropic', 'fake']).default('anthropic'),
  ANTHROPIC_API_KEY: z.string().optional(),
  LLM_MODEL: z.string().default('claude-opus-5-5'),
  LLM_EXTRACTION_EFFORT: z.enum(['low', 'medium', 'high']).default('low'),
  LLM_CHAT_EFFORT: z.enum(['low', 'medium', 'high']).default('medium'),
  EMBEDDINGS_PROVIDER: z.enum(['local', 'fake']).default('local'),
  EMBEDDINGS_MODEL: z.string().default('Xenova/bge-small-en-v1.5'),
  MODELS_CACHE_DIR: z.string().default('.models'),
  TRANSCRIPTION_PROVIDER: z.enum(['local', 'fake', 'off']).default('local'),
  TRANSCRIPTION_MODEL: z.string().default('Xenova/whisper-base.en'),
  MAX_UPLOAD_MB: z.coerce.number().default(2),
  MAX_AUDIO_MB: z.coerce.number().default(50),
  MAX_QUESTION_CHARS: z.coerce.number().int().default(2000),
  CONTEXT_CHAR_BUDGET: z.coerce.number().int().default(24000),
});

export type Config = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return schema.parse(env);
}
