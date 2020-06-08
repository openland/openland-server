import { Metrics } from 'openland-module-monitoring/Metrics';
import { STracer } from '../STracer';
import { SSpan } from '../SSpan';
import { Context } from '@openland/context';
import { TracingContext } from './TracingContext';

export class OpenSpan implements SSpan {
    readonly instance: any;
    private readonly tracer: any;

    constructor(src: any, name: string, parent?: SSpan, args?: any) {
        this.tracer = src;
        this.instance = this.tracer.startSpan(name, { ...args, childOf: parent ? (parent as any).instance : undefined });
    }

    finish() {
        this.instance.finish();
    }
}

export class OpenTracer implements STracer {
    private readonly tracer: any;

    constructor(src: any) {
        this.tracer = src;
    }

    startSpan(name: string, parent?: SSpan, args?: any) {
        Metrics.TracingFrequence.inc();
        return new OpenSpan(this.tracer, name, parent, args);
    }

    async trace<T>(ctx: Context, op: string, handler: (ctx: Context) => Promise<T>, args?: any): Promise<T> {
        Metrics.TracingFrequence.inc();
        let c = TracingContext.get(ctx);
        let span = this.startSpan(op, c.span ? c.span : undefined, args);
        ctx = TracingContext.set(ctx, { span });
        try {
            return await handler(ctx);
        } finally {
            span.finish();
        }
    }

    traceSync<T>(ctx: Context, op: string, handler: (ctx: Context) => T, args?: any): T {
        Metrics.TracingFrequence.inc();
        let c = TracingContext.get(ctx);
        let span = this.startSpan(op, c.span ? c.span : undefined, args);
        ctx = TracingContext.set(ctx, { span });
        try {
            return handler(ctx);
        } finally {
            span.finish();
        }
    }

}