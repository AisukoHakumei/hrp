import pino from 'pino';
import { config } from './config.js';

export const logger = pino({
	level: config.logLevel,
	transport: config.isProduction
		? undefined
		: {
				target: 'pino-pretty',
				options: {
					colorize: true,
					translateTime: 'SYS:standard',
					ignore: 'pid,hostname'
				}
			}
});

/** Create a child logger scoped to a module */
export function createLogger(module: string) {
	return logger.child({ module });
}
