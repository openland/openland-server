import { setTransactionTracer, setSubspaceTracer } from '@openland/foundationdb/lib/tracing';
// import { LogPathContext } from '@openland/log';
// import { createTracer } from '../openland-log/createTracer';
// import { Context, ContextName } from '@openland/context';
// import {
//     seAtomicBooleanFactoryTracer,
//     seAtomicIntegerFactoryTracer,
//     setEntityFactoryTracer
// } from '@openland/foundationdb-entity/lib/tracing';
// import { createZippedLogger } from '../openland-utils/ZippedLogger';
import { createMetric } from 'openland-module-monitoring/Metric';
import { getConcurrencyPool } from 'openland-utils/ConcurrencyPool';
import { createLogger } from '@openland/log';
import { encoders } from '@openland/foundationdb';
// import { Context, ContextName } from '@openland/context';
// import { LogPathContext } from '@openland/log';

// const isProduction = process.env.NODE_ENV === 'production';
// const logger = (isProduction ? createZippedLogger : createLogger)('FDB');
// const tracer = createTracer('FDB');

// const getContextPath = (ctx: Context) => ContextName.get(ctx) + ' ' + LogPathContext.get(ctx).join('->');

const ephemeralTx = createMetric('tx-ephemeral', 'sum');
const newTx = createMetric('tx-start', 'sum');
const commitTx = createMetric('tx-commit', 'sum');
const retryTx = createMetric('tx-retry', 'sum');
const opRead = createMetric('op-read', 'sum');
const opWrite = createMetric('op-write', 'sum');

let valueLengthLimitLogger = createLogger('fdb-tracing');

export function setupFdbTracing() {
    setTransactionTracer({
        tx: async (ctx, handler) => {
            newTx.increment(ctx);
            // return await tracer.trace(ctx, 'transaction', () => handler(), { tags: { contextPath: getContextPath(ctx) } });
            return handler(ctx);
        },
        commit: async (ctx, handler) => {
            commitTx.increment(ctx);
            // return await tracer.trace(ctx, 'transaction commit', () => handler(), { tags: { contextPath: getContextPath(ctx) } })
            return handler();
        },
        onNewReadWriteTx: (ctx) => newTx.increment(ctx),
        onRetry: (ctx) => {
            retryTx.increment(ctx);
        },
        onNewEphemeralTx: (ctx) => {
            ephemeralTx.increment(ctx);
        }
    });

    setSubspaceTracer({
        get: async (ctx, key, handler) => {
            opRead.increment(ctx);
            return getConcurrencyPool(ctx).run(handler);
            // return await tracer.trace(ctx, 'getKey', () => handler(), { tags: { contextPath: getContextPath(ctx) } });
        },
        set: (ctx, key, value, handler) => {
            opWrite.increment(ctx);
            if (value.byteLength > 100000) {
                valueLengthLimitLogger.log(ctx, 'Value length exceeds limit: ' + JSON.stringify(encoders.json.unpack(value)));
            }
            // return tracer.traceSync(ctx, 'setKey', () => handler(), { tags: { contextPath: getContextPath(ctx) } });
            return handler();
        },
        range: async (ctx, key, opts, handler) => {
            // return await tracer.trace(ctx, 'getRange', () => handler(), { tags: { contextPath: getContextPath(ctx) } });
            opRead.increment(ctx);
            let res = await getConcurrencyPool(ctx).run(handler);
            if (res.length > 0) {
                opRead.add(ctx, res.length);
            } else {
                opRead.add(ctx, 1);
            }
            return res;
        }
    });

    // setEntityFactoryTracer({
    //     findFromUniqueIndex: async (entityDescriptor, ctx, id, descriptor, handler) => {
    //         opRead.increment(ctx);
    //         // return await tracer.trace(ctx, entityDescriptor.name + '.findFromUniqueIndex', () => handler(), { tags: { contextPath: getContextPath(ctx) } }),
    //         return handler();
    //     },
    //     query: async (entityDescriptor, ctx, descriptor, id, opts, handler) => {
    //         opRead.increment(ctx);
    //         // return await tracer.trace(ctx, entityDescriptor.name + '.query', () => handler(), { tags: { contextPath: getContextPath(ctx) } });
    //         return handler();
    //     },
    //     findAll: async (entityDescriptor, ctx, handler) => {
    //         opRead.increment(ctx);
    //         // return await tracer.trace(ctx, entityDescriptor.name + '.findAll', () => handler(), { tags: { contextPath: getContextPath(ctx) } });
    //         return handler();
    //     },
    //     findById: async (entityDescriptor, ctx, id, handler) => {
    //         opRead.increment(ctx);
    //         // return await tracer.trace(ctx, entityDescriptor.name + '.findById', () => handler(), { tags: { contextPath: getContextPath(ctx) } });
    //         return handler();
    //     },
    //     create: async (entityDescriptor, ctx, id, value, handler) => {
    //         // return await tracer.trace(ctx, entityDescriptor.name + '.create', () => handler(), { tags: { contextPath: getContextPath(ctx) } });
    //         return handler();
    //     },
    //     flush: async (entityDescriptor, ctx, id, oldValue, newValue, handler) => {
    //         // return await tracer.trace(ctx, entityDescriptor.name + '.flush', () => handler(), { tags: { contextPath: getContextPath(ctx) } });
    //         return handler();
    //     }
    // });

    // seAtomicBooleanFactoryTracer({
    //     get: async (directory, ctx, key, handler) => await tracer.trace(ctx, 'BooleanAtomic.get', () => handler(), { tags: { contextPath: getContextPath(ctx) } }),
    //     set: (directory, ctx, key, value, handler) => tracer.traceSync(ctx, 'BooleanAtomic.set', () => handler(), { tags: { contextPath: getContextPath(ctx) } })
    // });

    // seAtomicIntegerFactoryTracer({
    //     get: async (directory, ctx, key, handler) => await tracer.trace(ctx, 'IntegerAtomic.get', () => handler(), { tags: { contextPath: getContextPath(ctx) } }),
    //     set: (directory, ctx, key, value, handler) => tracer.traceSync(ctx, 'IntegerAtomic.set', () => handler(), { tags: { contextPath: getContextPath(ctx) } })
    // });
}