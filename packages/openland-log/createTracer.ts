var initTracer = require('jaeger-client').initTracer;

import { STracer, OpenTracer, NoOpTracer } from './src/STracer';
const enabled = true;
export function createTracer(name: string): STracer {
    var tracer: STracer;
    if (enabled && (process.env.TRACING_ENDPOINT || process.env.NODE_ENV !== 'production')) {
        tracer = new OpenTracer(initTracer({
            serviceName: name,
            'sampler': {
                'type': 'const',
                'param': 1,
            },
            reporter: {
                collectorEndpoint: process.env.NODE_ENV === 'production' ? process.env.TRACING_ENDPOINT : 'http://localhost:14268/api/traces',
            }
        }));
    } else {
        tracer = new NoOpTracer();
    }
    return tracer;
}