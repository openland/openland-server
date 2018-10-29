var initTracer = require('jaeger-client').initTracer;

export interface SSpan {
    finish(): void;
}

export interface STracer {
    startSpan(name: string, parent?: SSpan): SSpan;
}

class NoOpSpan implements SSpan {
    finish() {
        // Nothing to do
    }
}

class NoOpTracer implements STracer {
    startSpan(name: string, parent?: SSpan) {
        return new NoOpSpan();
    }
}

class OpenSpan implements SSpan {
    readonly instance: any;
    private readonly tracer: any;

    constructor(src: any, name: string, parent?: SSpan) {
        this.tracer = src;
        this.instance = this.tracer.startSpan(name, { childOf: parent ? (parent as any).instance : undefined });
    }

    finish() {
        this.instance.finish();
    }
}

class OpenTracer implements STracer {
    private readonly tracer: any;

    constructor(src: any) {
        this.tracer = src;
    }

    startSpan(name: string, parent?: SSpan) {
        return new OpenSpan(this.tracer, name, parent);
    }
}

var tracer: STracer;

if (process.env.TRACING_ENDPOINT || process.env.NODE_ENV !== 'production') {
    tracer = new OpenTracer(initTracer({
        serviceName: 'openland-server',
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

export const STracer = tracer;