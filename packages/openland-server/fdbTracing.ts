import { setSubspaceTracer, setTransactionTracer } from '@openland/foundationdb/lib/tracing';
import { createLogger, LogPathContext } from '@openland/log';
import { createTracer } from '../openland-log/createTracer';
import { Context, ContextName } from '@openland/context';

const logger = createLogger('FDB');
const tracer = createTracer('FDB');

const getContextPath = (ctx: Context) =>  ContextName.get(ctx) + ' ' + LogPathContext.get(ctx).join('->');

export function setupFdbTracing() {
    setTransactionTracer({
        tx: async (ctx, handler) => await tracer.trace(ctx, 'transaction ' + getContextPath(ctx), () => handler()),
        commit: async (ctx, handler) => await tracer.trace(ctx, 'transaction commit ' + getContextPath(ctx), () => handler()),
        onNewReadWriteTx: (ctx) => logger.log(ctx, 'new tx'),
        onRetry: (ctx) => logger.log(ctx, 'tx retry'),
    });

    setSubspaceTracer({
        get: async (ctx, key, handler) => await tracer.trace(ctx, 'GET ' + getContextPath(ctx), () => handler()),
        set: (ctx, key, value, handler) => tracer.traceSync(ctx, 'SET ' + getContextPath(ctx), () => handler()),
        range: async (ctx, key, opts, handler) => await tracer.trace(ctx, 'RANGE ' + getContextPath(ctx), () => handler())
    });
}