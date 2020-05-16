import { STracer } from './STracer';
import { OpenTracer } from './src/OpenTracer';
// import { NoOpTracer } from './src/NoOpTracer';
import { initTracer } from 'jaeger-client';

export function createTracer(name: string): STracer {
    var tracer: STracer;
    return new OpenTracer(initTracer({serviceName: name, sampler: {type: 'const', param: 1}}, {}));

    //     tracer = new OpenTracer(initTracer({ serviceName: name, sampler: { type: 'probabilistic', param: 0.1 } }, {}));
    // } else {
    //     tracer = new NoOpTracer();
    // }
    // if (!isProd) {
    //     tracer = new OpenTracer(initTracer({serviceName: name, sampler: {type: 'const', param: 1}}, {}));
    // } else {
    //     tracer = new NoOpTracer();
    // }
    return tracer;
}