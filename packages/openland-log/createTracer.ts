import { STracer } from './STracer';
import { OpenTracer } from './src/OpenTracer';
import { NoOpTracer } from './src/NoOpTracer';
import { initTracer } from 'jaeger-client';

const isProd = process.env.APP_ENVIRONMENT === 'production';

export function createTracer(name: string): STracer {
    var tracer: STracer;
    if (!isProd) {
        tracer = new OpenTracer(initTracer({serviceName: name, sampler: {type: 'const', param: 1}}, {}));
        // tracer = new OpenTracer(initTracer({serviceName: name, sampler: {type: 'probabilistic', param: 0.1}}, {}));
    } else {
        tracer = new NoOpTracer();
    }
    return tracer;
}