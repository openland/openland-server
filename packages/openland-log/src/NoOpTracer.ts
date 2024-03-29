// import { Metrics } from 'openland-module-monitoring/Metrics';
import { STracer } from '../STracer';
import { SSpan } from '../SSpan';
import { Context } from '@openland/context';

export class NoOpSpan implements SSpan {

    setTag(key: string, value: any) {
        // Nothing to do
    }

    finish() {
        // Nothing to do
    }
}

export class NoOpTracer implements STracer {
    startSpan(name: string, parent?: SSpan) {
        // Metrics.TracingFrequence.inc();
        return new NoOpSpan();
    }

    trace<T>(ctx: Context, op: string, handler: (ctx: Context) => Promise<T>): Promise<T> {
        // Metrics.TracingFrequence.inc();
        return handler(ctx);
    }
}