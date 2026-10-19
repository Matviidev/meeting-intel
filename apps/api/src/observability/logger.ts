import type { FastifyServerOptions } from 'fastify';
import type { Config } from '../config.js';

export function loggerOptions(config: Config): FastifyServerOptions['logger'] {
  if (config.NODE_ENV === 'test') return false;
  return {
    level: config.LOG_LEVEL,
    redact: ['req.headers.authorization', 'req.headers.cookie'],
    ...(config.NODE_ENV === 'development' && {
      transport: { target: 'pino-pretty', options: { singleLine: true } },
    }),
  };
}
