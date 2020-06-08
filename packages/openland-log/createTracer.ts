import { Config } from 'openland-config/Config';
import { STracer } from './STracer';
import { OpenTracer } from './src/OpenTracer';
import { NoOpTracer } from './src/NoOpTracer';
import { initTracer } from 'jaeger-client';

export function createTracer(name: string): STracer {
    if (Config.environment === 'production' && Config.enableTracing) {
        return new OpenTracer(initTracer({
            serviceName: name,
            sampler: { type: 'const', param: 1 }
        }, {}));
    } else {
        return new NoOpTracer();
    }
}