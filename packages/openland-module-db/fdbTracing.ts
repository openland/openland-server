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
import { counterNamespace, reportCounters, withCounters } from './FDBCounterContext';
import { ContextName } from '@openland/context';
import { Concurrency } from 'openland-server/concurrency';
import { FDBError } from 'foundationdb';
import { Config } from 'openland-config/Config';
// import { Context, ContextName } from '@openland/context';
// import { LogPathContext } from '@openland/log';

// const logger = (isProduction ? createZippedLogger : createLogger)('FDB');
const rawTracer = createTracer('FDB');
const entityTracer = createTracer('FDB-Entity');

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
        tx: async (parent, handler) => {
            let ctx = parent;
            const path = LogPathContext.get(ctx);
            if (!counterNamespace.get(ctx)) {
                ctx = withCounters(ctx);
            }
            let res = await rawTracer.trace(ctx, 'transaction', async (child) => {
                setTracingTag(child, 'path', path.join(' -> '));
                return await handler(child);
            });

            let ctxName = ContextName.get(ctx);
            const counters = reportCounters(ctx);
            if (counters) {
                Metrics.FDBReads.report(ctxName, counters.readCount);
                Metrics.FDBWrites.report(ctxName, counters.writeCount);
            }

            return res;
        },
        txIteration: async (ctx, handler) => {
            let ctxName = ContextName.get(ctx);
            Metrics.FDBTransactions.inc(ctxName);
            Metrics.FDBTransactionsActive.inc(Config.hostname);
            Metrics.FDBTransactionsActiveContext.inc(ctxName);
            try {
                return await Concurrency.Transaction.run(async () => {
                    return await rawTracer.trace(ctx, 'transaction:iteration', async (child) => {
                        let txch = withConcurrentcyPool(child, Concurrency.TransactionOperations());
                        return await handler(txch);
                    });
                });
            } finally {
                Metrics.FDBTransactionsActive.dec(Config.hostname);
                Metrics.FDBTransactionsActiveContext.dec(ctxName);
            }
        },
        commit: async (parent, handler) => {
            return await rawTracer.trace(parent, 'commit', (ctx) => handler(ctx));
        },
        commitPreHook: async (parent, handler) => {
            return await rawTracer.trace(parent, 'preHook', (ctx) => handler(ctx));
        },
        commitFDB: async (parent, handler) => {
            return await rawTracer.trace(parent, 'rawCommit', (ctx) => handler(ctx));
        },
        commitPostHook: async (parent, handler) => {
            return await rawTracer.trace(parent, 'postHook', (ctx) => handler(ctx));
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
            Metrics.FDBContextErrors.inc(ContextName.get(ctx));
            if (error.code === 1007) {
                Metrics.FDBTooOldErrors.inc(ContextName.get(ctx));
            }
        }
    });

    setSubspaceTracer({
        get: async (ctx, key, handler) => {
            let counter = counterNamespace.get(ctx);
            if (counter) {
                counter.readCount++;
            }

            return await rawTracer.trace(ctx, 'getKey', async (child) => {
                const path = LogPathContext.get(ctx);
                setTracingTag(child, 'path', path.join(' -> '));
                return await getConcurrencyPool(child).run(() => rawTracer.trace(child, 'getKey:do', () => handler()));
            });
            // return await tracer.trace(ctx, 'getKey', () => handler(), { tags: { contextPath: getContextPath(ctx) } });
        },
        set: (ctx, key, value, handler) => {
            let counter = counterNamespace.get(ctx);
            if (counter) {
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
            return await rawTracer.trace(ctx, 'getRange', async (child) => {
                const path = LogPathContext.get(ctx);
                setTracingTag(child, 'path', path.join(' -> '));
                let res = await getConcurrencyPool(ctx).run(() => rawTracer.trace(child, 'getRange:do', () => handler()));
                let counter = counterNamespace.get(ctx);
                if (counter) {
                    counter.readCount += res.length;
                }
                return res;
            });
        }
    });

    setEntityFactoryTracer({
        findFromUniqueIndex: async (entityDescriptor, parent, id, descriptor, handler) => {
            return await entityTracer.trace(parent, entityDescriptor.name + '.findFromUniqueIndex', (ctx) => handler(ctx));
        },
        query: async (entityDescriptor, parent, descriptor, id, opts, handler) => {
            return await entityTracer.trace(parent, entityDescriptor.name + '.query', (ctx) => handler(ctx));
        },
        findAll: async (entityDescriptor, parent, handler) => {
            return await entityTracer.trace(parent, entityDescriptor.name + '.findAll', (ctx) => handler(ctx));
        },
        findById: async (entityDescriptor, parent, id, handler) => {
            return await entityTracer.trace(parent, entityDescriptor.name + '.findById', (ctx) => handler(ctx));
        },
        create: async (entityDescriptor, parent, id, value, handler) => {
            return await entityTracer.trace(parent, entityDescriptor.name + '.create', (ctx) => handler(ctx));
        },
        flush: async (entityDescriptor, parent, id, oldValue, newValue, handler) => {
            return await entityTracer.trace(parent, entityDescriptor.name + '.flush', (ctx) => handler(ctx));
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