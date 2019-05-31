import { STracer } from './STracer';
import { OpenTracer } from './src/OpenTracer';
import { NoOpTracer } from './src/NoOpTracer';
import { initTracer } from 'jaeger-client';
// var initTracer = require('jaeger-client').initTracer;
const enabled = true;

export function createTracer(name: string): STracer {
    var tracer: STracer;
    if (enabled && (process.env.TRACING || process.env.NODE_ENV !== 'production')) {
        tracer = new OpenTracer(initTracer({ serviceName: name, sampler: { type: 'probabilistic', param: 0.1 } }, {}));
    } else {
        tracer = new NoOpTracer();
    }
    return tracer;
}