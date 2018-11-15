import { STracer } from '../STracer';
import { SSpan } from '../SSpan';
import { Context } from 'openland-utils/Context';

export class NoOpSpan implements SSpan {
    finish() {
        // Nothing to do
    }
}

export class NoOpTracer implements STracer {
    startSpan(name: string, parent?: SSpan, args?: any) {
        return new NoOpSpan();
    }

    async trace<T>(ctx: Context, op: string, handler: (ctx: Context) => Promise<T>): Promise<T> {
        return handler(ctx);
    }

    traceSync<T>(ctx: Context, op: string, handler: (ctx: Context) => T): T {
        return handler(ctx);
    }
}