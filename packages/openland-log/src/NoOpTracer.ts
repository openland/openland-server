import { Metrics } from 'openland-module-monitoring/Metrics';
import { STracer } from '../STracer';
import { SSpan } from '../SSpan';
import { Context } from '@openland/context';

export class NoOpSpan implements SSpan {
    finish() {
        // Nothing to do
    }
}

export class NoOpTracer implements STracer {
    startSpan(name: string, parent?: SSpan, args?: any) {
        Metrics.TracingFrequence.inc();
        return new NoOpSpan();
    }

    async trace<T>(ctx: Context, op: string, handler: (ctx: Context) => Promise<T>): Promise<T> {
        Metrics.TracingFrequence.inc();
        return handler(ctx);
    }
}