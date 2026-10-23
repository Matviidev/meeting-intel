import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

export class Metrics {
  readonly registry = new Registry();

  readonly httpDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.01, 0.05, 0.1, 0.3, 1, 3, 10, 30],
    registers: [this.registry],
  });

  readonly chatRequests = new Counter({
    name: 'chat_requests_total',
    help: 'Chat requests by outcome',
    labelNames: ['outcome'],
    registers: [this.registry],
  });

  readonly chatFirstToken = new Histogram({
    name: 'chat_first_token_seconds',
    help: 'Time to first streamed token',
    buckets: [0.25, 0.5, 1, 2, 4, 8, 16],
    registers: [this.registry],
  });

  readonly retrievalDuration = new Histogram({
    name: 'retrieval_duration_seconds',
    help: 'Hybrid retrieval duration',
    buckets: [0.005, 0.01, 0.05, 0.1, 0.25, 0.5, 1],
    registers: [this.registry],
  });

  readonly llmTokens = new Counter({
    name: 'llm_tokens_total',
    help: 'LLM tokens by direction',
    labelNames: ['direction'],
    registers: [this.registry],
  });

  readonly guardrailFlags = new Counter({
    name: 'guardrail_flags_total',
    help: 'Guardrail flags raised',
    labelNames: ['flag'],
    registers: [this.registry],
  });

  readonly ingestDuration = new Histogram({
    name: 'ingest_duration_seconds',
    help: 'Transcript ingestion duration',
    buckets: [0.5, 1, 2, 5, 10, 20, 40, 80],
    registers: [this.registry],
  });

  readonly transcribeDuration = new Histogram({
    name: 'transcribe_duration_seconds',
    help: 'Audio transcription and speaker labelling duration',
    buckets: [1, 5, 10, 30, 60, 120, 300, 600],
    registers: [this.registry],
  });

  readonly extractedItems = new Counter({
    name: 'extracted_items_total',
    help: 'Decisions and action items extracted from transcripts',
    labelNames: ['kind'],
    registers: [this.registry],
  });

  constructor(collectDefaults = true) {
    if (collectDefaults) collectDefaultMetrics({ register: this.registry });
  }
}
