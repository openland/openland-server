import { setTransactionTracer, setSubspaceTracer } from '@openland/foundationdb/lib/tracing';
// import { LogPathContext } from '@openland/log';
// import { createTracer } from '../openland-log/createTracer';
// import { Context, ContextName, createContextNamespace } from '@openland/context';
import {
    setEntityFactoryTracer
} from '@openland/foundationdb-entity/lib/tracing';
// import { createZippedLogger } from '../openland-utils/ZippedLogger';
// import { createMetric } from 'openland-module-monitoring/Metric';
import { getConcurrencyPool, withConcurrentcyPool } from 'openland-utils/ConcurrencyPool';
import { createLogger, LogPathContext } from '@openland/log';
import { encoders, WriteToReadOnlyContextError } from '@openland/foundationdb';
import { createTracer } from 'openland-log/createTracer';
import { setTracingTag } from '../openland-log/setTracingTag';
import { Metrics } from 'openland-module-monitoring/Metrics';
import { isWithinSpaceX } from 'openland-spacex/SpaceXContext';
import { counterNamespace } from './FDBCounterContext';
import { ContextName } from '@openland/context';
import { Concurrency } from 'openland-server/concurrency';
import { FDBError } from 'foundationdb';
import { Config } from 'openland-config/Config';
// import { Context, ContextName } from '@openland/context';
// import { LogPathContext } from '@openland/log';

// const logger = (isProduction ? createZippedLogger : createLogger)('FDB');
const tracer = createTracer('FDB');

// const getContextPath = (ctx: Context) => ContextName.get(ctx) + ' ' + LogPathContext.get(ctx).join('->');

// const ephemeralTx = createMetric('tx-ephemeral', 'sum');
// const newTx = createMetric('tx-start', 'sum');
// const commitTx = createMetric('tx-commit', 'sum');
// const retryTx = createMetric('tx-retry', 'sum');
// const opRead = createMetric('op-read', 'sum');
// const opWrite = createMetric('op-write', 'sum');

let logger = createLogger('fdb-tracing');

export function setupFdbTracing() {
    setTransactionTracer({
        tx: async (ctx, handler) => {
            const path = LogPathContext.get(ctx);
            return await tracer.trace(ctx, 'transaction', async (child) => {
                setTracingTag(child, 'path', path.join(' -> '));
                return await handler(child);
            });
        },
        txIteration: async (ctx, handler) => {
            Metrics.FDBTransactions.inc(ContextName.get(ctx));
            Metrics.FDBTransactionsActive.inc(Config.hostname);
            try {
                return await Concurrency.Transaction.run(async () => {
                    return await tracer.trace(ctx, 'transaction:iteration', async (child) => {
                        let txch = withConcurrentcyPool(child, Concurrency.TransactionOperations());
                        return await handler(txch);
                    });
                });
            } finally {
                Metrics.FDBTransactionsActive.dec(Config.hostname);
            }
        },
        commit: async (ctx, handler) => {
            // commitTx.increment(ctx);
            // return await tracer.trace(ctx, 'transaction commit', () => handler(), { tags: { contextPath: getContextPath(ctx) } })
            return handler();
        },
        onTx: (ctx) => {
            // newTx.increment(ctx);
        },
        onRetry: (ctx) => {
            if (isWithinSpaceX(ctx)) {
                Metrics.SpaceXRetry.inc();
            }
        },
        onError: (ctx, error) => {
            if (error instanceof FDBError) {
                if (error.code === 1020) { // Retry
                    return;
                }
                logger.error(ctx, error);
            }
            if (error instanceof WriteToReadOnlyContextError) {
                logger.error(ctx, error);
            }
        },
        onFDBError: (ctx, error) => {
            Metrics.FDBErrors.inc(error.code + '');
            if (error.code === 1007) {
                Metrics.FDBTooOldErrors.inc(ContextName.get(ctx));
            }
        }
    });

    setSubspaceTracer({
        get: async (ctx, key, handler) => {
            let counter = counterNamespace.get(ctx);
            if (counter && !counter.flushed) {
                counter.readCount++;
            }

            return await tracer.trace(ctx, 'getKey', async (child) => {
                const path = LogPathContext.get(ctx);
                setTracingTag(child, 'path', path.join(' -> '));
                return await getConcurrencyPool(child).run(() => tracer.trace(child, 'getKey:do', () => handler()));
            });
            // return await tracer.trace(ctx, 'getKey', () => handler(), { tags: { contextPath: getContextPath(ctx) } });
        },
        set: (ctx, key, value, handler) => {
            let counter = counterNamespace.get(ctx);
            if (counter && !counter.flushed) {
                counter.writeCount++;
            }

            // opWrite.increment(ctx);
            if (value.byteLength > 100000) {
                logger.log(ctx, 'Value length exceeds limit: ' + JSON.stringify(encoders.json.unpack(value)));
            }
            // return tracer.traceSync(ctx, 'setKey', () => handler(), { tags: { contextPath: getContextPath(ctx) } });
            return handler();
        },
        range: async (ctx, key, opts, handler) => {
            return await tracer.trace(ctx, 'getRange', async (child) => {
                const path = LogPathContext.get(ctx);
                setTracingTag(child, 'path', path.join(' -> '));
                let res = await getConcurrencyPool(ctx).run(() => tracer.trace(child, 'getRange:do', () => handler()));
                let counter = counterNamespace.get(ctx);
                if (counter && !counter.flushed) {
                    counter.readCount += res.length;
                }
                return res;
            });
        }
    });

    setEntityFactoryTracer({
        findFromUniqueIndex: async (entityDescriptor, ctx, id, descriptor, handler) => {
            return await tracer.trace(ctx, entityDescriptor.name + '.findFromUniqueIndex', () => handler());
        },
        query: async (entityDescriptor, ctx, descriptor, id, opts, handler) => {
            return await tracer.trace(ctx, entityDescriptor.name + '.query', () => handler());
        },
        findAll: async (entityDescriptor, ctx, handler) => {
            return await tracer.trace(ctx, entityDescriptor.name + '.findAll', () => handler());
        },
        findById: async (entityDescriptor, ctx, id, handler) => {
            return await tracer.trace(ctx, entityDescriptor.name + '.findById', () => handler());
        },
        create: async (entityDescriptor, ctx, id, value, handler) => {
            return await tracer.trace(ctx, entityDescriptor.name + '.create', () => handler());
        },
        flush: async (entityDescriptor, ctx, id, oldValue, newValue, handler) => {
            return await tracer.trace(ctx, entityDescriptor.name + '.flush', () => handler());
        }
    });

    // seAtomicBooleanFactoryTracer({
    //     get: async (directory, ctx, key, handler) => await tracer.trace(ctx, 'BooleanAtomic.get', () => handler(), { tags: { contextPath: getContextPath(ctx) } }),
    //     set: (directory, ctx, key, value, handler) => tracer.traceSync(ctx, 'BooleanAtomic.set', () => handler(), { tags: { contextPath: getContextPath(ctx) } })
    // });

    // seAtomicIntegerFactoryTracer({
    //     get: async (directory, ctx, key, handler) => await tracer.trace(ctx, 'IntegerAtomic.get', () => handler(), { tags: { contextPath: getContextPath(ctx) } }),
    //     set: (directory, ctx, key, value, handler) => tracer.traceSync(ctx, 'IntegerAtomic.set', () => handler(), { tags: { contextPath: getContextPath(ctx) } })
    // });
}