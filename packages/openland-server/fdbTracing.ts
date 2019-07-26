import { setSubspaceTracer, setTransactionTracer } from '@openland/foundationdb/lib/tracing';
import { createLogger, LogPathContext } from '@openland/log';
import { createTracer } from '../openland-log/createTracer';
import { Context, ContextName } from '@openland/context';

const logger = createLogger('FDB');
const tracer = createTracer('FDB');

const getContextPath = (ctx: Context) =>  ContextName.get(ctx) + ' ' + LogPathContext.get(ctx).join('->');

export function setupFdbTracing() {
    setTransactionTracer({
        tx: async (ctx, handler) => await tracer.trace(ctx, 'transaction', () => handler(), { tags: { contextPath: getContextPath(ctx) } }),
        commit: async (ctx, handler) => await tracer.trace(ctx, 'transaction commit', () => handler(), { tags: { contextPath: getContextPath(ctx) } }),
        onNewReadWriteTx: (ctx) => logger.log(ctx, 'new tx'),
        onRetry: (ctx) => logger.log(ctx, 'tx retry'),
    });

    setSubspaceTracer({
        get: async (ctx, key, handler) => await tracer.trace(ctx, 'getKey', () => handler(), { tags: { contextPath: getContextPath(ctx) } }),
        set: (ctx, key, value, handler) => tracer.traceSync(ctx, 'setKey', () => handler(), { tags: { contextPath: getContextPath(ctx) } }),
        range: async (ctx, key, opts, handler) => await tracer.trace(ctx, 'getRange', () => handler(), { tags: { contextPath: getContextPath(ctx) } })
    });
}