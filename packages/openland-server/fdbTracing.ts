import { setTransactionTracer } from '@openland/foundationdb/lib/tracing';
import { createLogger, LogPathContext } from '@openland/log';
import { createTracer } from '../openland-log/createTracer';
import { Context, ContextName } from '@openland/context';
import {
    seAtomicBooleanFactoryTracer,
    seAtomicIntegerFactoryTracer,
    setEntityFactoryTracer
} from '@openland/foundationdb-entity/lib/tracing';
import { createZippedLogger } from '../openland-utils/ZippedLogger';

const isProduction = process.env.NODE_ENV === 'production';
const logger = (isProduction ? createZippedLogger : createLogger)('FDB');
const tracer = createTracer('FDB');

const getContextPath = (ctx: Context) =>  ContextName.get(ctx) + ' ' + LogPathContext.get(ctx).join('->');

export function setupFdbTracing() {
    setTransactionTracer({
        tx: async (ctx, handler) => {
            // logger.log(ctx, 'start tx');
            return await tracer.trace(ctx, 'transaction', () => handler(), { tags: { contextPath: getContextPath(ctx) } });
        },
        commit: async (ctx, handler) => await tracer.trace(ctx, 'transaction commit', () => handler(), { tags: { contextPath: getContextPath(ctx) } }),
        onNewReadWriteTx: (ctx) => {
            // logger.log(ctx, 'new tx')
        },
        onRetry: (ctx) => logger.log(ctx, 'retry tx'),
    });

    // setSubspaceTracer({
    //     get: async (ctx, key, handler) => await tracer.trace(ctx, 'getKey', () => handler(), { tags: { contextPath: getContextPath(ctx) } }),
    //     set: (ctx, key, value, handler) => tracer.traceSync(ctx, 'setKey', () => handler(), { tags: { contextPath: getContextPath(ctx) } }),
    //     range: async (ctx, key, opts, handler) => await tracer.trace(ctx, 'getRange', () => handler(), { tags: { contextPath: getContextPath(ctx) } })
    // });

    setEntityFactoryTracer({
        findFromUniqueIndex: async (entityDescriptor, ctx, id, descriptor, handler) => await tracer.trace(ctx,  entityDescriptor.name + '.findFromUniqueIndex', () => handler(), { tags: { contextPath: getContextPath(ctx) } }),
        query: async (entityDescriptor, ctx, descriptor, id, opts, handler) => await tracer.trace(ctx,  entityDescriptor.name + '.query', () => handler(), { tags: { contextPath: getContextPath(ctx) } }),
        findAll: async (entityDescriptor, ctx, handler) => await tracer.trace(ctx,  entityDescriptor.name + '.findAll', () => handler(), { tags: { contextPath: getContextPath(ctx) } }),
        findById: async (entityDescriptor, ctx, id, handler) => await tracer.trace(ctx,  entityDescriptor.name + '.findById', () => handler(), { tags: { contextPath: getContextPath(ctx) } }),
        create: async (entityDescriptor, ctx, id, value, handler) => await tracer.trace(ctx,  entityDescriptor.name + '.create', () => handler(), { tags: { contextPath: getContextPath(ctx) } }),
        flush: async (entityDescriptor, ctx, id, oldValue, newValue, handler) => await tracer.trace(ctx,  entityDescriptor.name + '.flush', () => handler(), { tags: { contextPath: getContextPath(ctx) } })
    });

    seAtomicBooleanFactoryTracer({
        get: async (directory, ctx, key, handler) => await tracer.trace(ctx, 'BooleanAtomic.get', () => handler(), { tags: { contextPath: getContextPath(ctx) } }),
        set: (directory, ctx, key, value, handler) => tracer.traceSync(ctx, 'BooleanAtomic.set', () => handler(), { tags: { contextPath: getContextPath(ctx) } })
    });

    seAtomicIntegerFactoryTracer({
        get: async (directory, ctx, key, handler) => await tracer.trace(ctx, 'IntegerAtomic.get', () => handler(), { tags: { contextPath: getContextPath(ctx) } }),
        set: (directory, ctx, key, value, handler) => tracer.traceSync(ctx, 'IntegerAtomic.set', () => handler(), { tags: { contextPath: getContextPath(ctx) } })
    });
}