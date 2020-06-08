import { Metrics } from 'openland-module-monitoring/Metrics';
import { STracer } from '../STracer';
import { SSpan } from '../SSpan';
import { Context } from '@openland/context';
import { TracingContext } from './TracingContext';
import { JaegerTracer } from 'jaeger-client';
import { Span } from 'opentracing';

export class OpenSpan implements SSpan {
    readonly instance: Span;
    private readonly tracer: JaegerTracer;

    constructor(src: JaegerTracer, name: string, parent?: SSpan) {
        this.tracer = src;
        this.instance = this.tracer.startSpan(name, {
            childOf: parent ? (parent as OpenSpan).instance.context() : undefined
        });
    }

    setTag(key: string, value: any) {
        this.instance.setTag(key, value);
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

    startSpan(name: string, parent?: SSpan) {
        Metrics.TracingFrequence.inc();
        return new OpenSpan(this.tracer, name, parent);
    }

    async trace<T>(parent: Context, op: string, handler: (ctx: Context) => Promise<T>, tags?: { [key: string]: any }): Promise<T> {
        Metrics.TracingFrequence.inc();
        let c = TracingContext.get(parent);
        let span = this.startSpan(op, c.span ? c.span : undefined);
        if (tags) {
            for (let [key, value] of Object.entries(tags)) {
                span.setTag(key, value);
            }
        }
        let ctx = TracingContext.set(parent, { span });
        try {
            return await handler(ctx);
        } finally {
            span.finish();
        }
    }
}