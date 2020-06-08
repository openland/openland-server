import { createLogger } from '@openland/log';
import uuid from 'uuid/v4';
import { Metrics } from 'openland-module-monitoring/Metrics';
import { STracer } from '../STracer';
import { SSpan } from '../SSpan';
import { Context, createNamedContext } from '@openland/context';
import { TracingContext } from './TracingContext';
import { JaegerTracer } from 'jaeger-client';
import { Span } from 'opentracing';

const logger = createLogger('tracer');
const rootCtx = createNamedContext('reporter');

export class OpenSpan implements SSpan {
    readonly id = uuid();
    readonly instance: Span;
    private readonly tracer: JaegerTracer;

    constructor(src: JaegerTracer, name: string, parent?: SSpan) {
        this.tracer = src;
        this.instance = this.tracer.startSpan(name, {
            childOf: parent ? (parent as OpenSpan).instance.context() : undefined
        });
        logger.log(rootCtx, 'start span ' + this.id);
    }

    finish() {
        this.instance.finish();
        logger.log(rootCtx, 'finish span ' + this.id);
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

    async trace<T>(parent: Context, op: string, handler: (ctx: Context) => Promise<T>): Promise<T> {
        Metrics.TracingFrequence.inc();
        let c = TracingContext.get(parent);
        let span = this.startSpan(op, c.span ? c.span : undefined);
        let ctx = TracingContext.set(parent, { span });
        try {
            return await handler(ctx);
        } finally {
            span.finish();
        }
    }
}