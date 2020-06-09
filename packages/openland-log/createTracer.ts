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
        logger.log(ctx, 'Declared tracer ' + name + ' ' + JSON.stringify({
            endpoint: process.env.JAEGER_ENDPOINT || null,
            agentHost: process.env.JAEGER_AGENT_HOST || null,
            agentPort: process.env.JAEGER_AGENT_PORT || null
        }));
        return new OpenTracer(initTracer({
            serviceName: name,
            sampler: { type: 'probabilistic', param: 0.1 },
            reporter: {
                logSpans: false,
                collectorEndpoint: process.env.JAEGER_ENDPOINT ? process.env.JAEGER_ENDPOINT : undefined,
                agentHost: process.env.JAEGER_AGENT_HOST ? process.env.JAEGER_AGENT_HOST : undefined,
                agentPort: process.env.JAEGER_AGENT_PORT ? parseInt(process.env.JAEGER_AGENT_PORT, 10) : undefined
            }
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