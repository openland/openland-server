var initTracer = require('jaeger-client').initTracer;

export interface SSpan {
    finish(): void;
}

export interface STracer {
    startSpan(name: string): SSpan;
}

class NoOpSpan implements SSpan {
    finish() {
        // Nothing to do
    }
}

class NoOpTracer implements STracer {
    startSpan(name: string) {
        return new NoOpSpan();
    }
}

var tracer: STracer;

if (process.env.TRACING_ENDPOINT) {
    tracer = initTracer({
        serviceName: 'openland-server',
        'sampler': {
            'type': 'const',
            'param': 1,
        },
        reporter: {
            collectorEndpoint: process.env.TRACING_ENDPOINT,
        }
    });
} else {
    tracer = new NoOpTracer();
}

export const STracer = tracer;