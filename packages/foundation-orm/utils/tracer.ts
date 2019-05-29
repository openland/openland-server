import { createTracer } from 'openland-log/createTracer';
import { createLogger } from 'openland-log/createLogger';

export const tracer = createTracer('fdb');

export const logger = createLogger('fdb', true);