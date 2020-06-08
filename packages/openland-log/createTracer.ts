import { createNamedContext } from '@openland/context';
import { createLogger } from '@openland/log';
import { Config } from 'openland-config/Config';
import { STracer } from './STracer';
import { OpenTracer } from './src/OpenTracer';
import { NoOpTracer } from './src/NoOpTracer';
import { initTracer } from 'jaeger-client';

const logger = createLogger('jaeger');
const ctx = createNamedContext('reporter');

export function createTracer(name: string): STracer {
    if (Config.environment === 'production' && Config.enableTracing) {
        return new OpenTracer(initTracer({
            serviceName: name,
            sampler: { type: 'const', param: 1 }
        }, {
            logger: {
                info: (src) => logger.log(ctx, src),
                error: (src) => logger.warn(ctx, src),
            }
        }));
    } else {
        return new NoOpTracer();
    }
}