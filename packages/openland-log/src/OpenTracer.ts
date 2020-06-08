import { Metrics } from 'openland-module-monitoring/Metrics';
import { STracer } from '../STracer';
import { SSpan } from '../SSpan';
import { Context } from '@openland/context';
import { TracingContext } from './TracingContext';
import { JaegerTracer } from 'jaeger-client';

export class OpenSpan implements SSpan {
    readonly instance: any;
    private readonly tracer: JaegerTracer;

    constructor(src: JaegerTracer, name: string, parent?: SSpan, args?: any) {
        this.tracer = src;
        this.instance = this.tracer.startSpan(name, { ...args, childOf: parent ? (parent as any).instance : undefined });
    }

    finish() {
        this.instance.finish();
    }
}

export class OpenTracer implements STracer {
    private readonly tracer: JaegerTracer;

    constructor(src: JaegerTracer) {
        this.tracer = src;
    }

    startSpan(name: string, parent?: SSpan, args?: any) {
        Metrics.TracingFrequence.inc();
        return new OpenSpan(this.tracer, name, parent, args);
    }

    async trace<T>(parent: Context, op: string, handler: (ctx: Context) => Promise<T>, args?: any): Promise<T> {
        Metrics.TracingFrequence.inc();
        let c = TracingContext.get(parent);
        let span = this.startSpan(op, c.span ? c.span : undefined, args);
        let ctx = TracingContext.set(parent, { span });
        try {
            return await handler(ctx);
        } finally {
            span.finish();
        }
    }
}