import { FormattedError } from './../openland-errors/index';
import { UnboundedConcurrencyPool } from './../openland-utils/ConcurrencyPool';
import { Modules } from 'openland-modules/Modules';
import { SpaceXContext } from './SpaceXContext';
import { currentRunningTime } from 'openland-utils/timer';
import { withoutTransaction, inTx, inHybridTx, createDefaultTaskExecutor, TransactionContext, getTransaction } from '@openland/foundationdb';
import { createTracer } from 'openland-log/createTracer';
import { createLogger } from '@openland/log';
import { Config } from 'openland-config/Config';
import { ConcurrencyPool } from 'openland-utils/ConcurrencyPool';
// import { Concurrency } from './../openland-server/concurrency';
import uuid from 'uuid/v4';
import { Metrics } from 'openland-module-monitoring/Metrics';
import { Context, ContextName, createNamedContext } from '@openland/context';
import { DocumentNode, GraphQLSchema, createSourceEventStream, ExecutionResult } from 'graphql';
import { getOperation } from './utils/getOperation';
import { setTracingTag } from 'openland-log/setTracingTag';
import { isAsyncIterator } from 'openland-mtproto3/utils';
import { isContextCancelled, withLifetime, cancelContext } from '@openland/lifetime';
import { IDs } from 'openland-module-api/IDs';
import { execute } from 'openland-module-api/execute';
import { getOperationField } from './utils/getOperationField';
import { resolveRemote } from './resolveRemote';
import { callRemoteQueryExecutor } from './remoteExecutor';
import { spaceFormatError } from './spaceFormatError';

export type SpaceXSessionDescriptor = { type: 'anonymnous' } | { type: 'authenticated', uid: number, tid: string };

export interface SpaceXSessionParams {
    readonly descriptor: SpaceXSessionDescriptor;
    readonly schema: GraphQLSchema;
}

export type SpaceXFormattedError = (FormattedError & { locations: any, path: any });

type InternalOpResult = {
    data: any;
} | {
    errors: SpaceXFormattedError[];
};

function isErrored(src: InternalOpResult): src is { errors: SpaceXFormattedError[] } {
    return !!(src as any).errors;
}

export type OpResult = {
    type: 'data';
    data: any;
} | {
    type: 'errors';
    errors: SpaceXFormattedError[];
} | {
    type: 'aborted';
} | {
    type: 'completed';
};

export type OpRef = {
    id: string;
    cancel: () => void;
};

let activeSessions = new Map<string, SpaceXSession>();
const spaceXCtx = createNamedContext('spacex');
const logger = createLogger('spacex');
const tracer = createTracer('spacex');
const typingsExecutor = createDefaultTaskExecutor('typings-task-executor', 10, 50);
const chatOnlineExecutor = createDefaultTaskExecutor('chat-online-task-executor', 10, 100);
const userOnlineExecutor = createDefaultTaskExecutor('user-online-task-executor', 10, 100);

export class SpaceXSession {
    readonly uuid = uuid();
    readonly descriptor: SpaceXSessionDescriptor;
    private readonly schema: GraphQLSchema;
    private readonly concurrencyPool: ConcurrencyPool;
    private closed = false;
    private activeOperations = new Map<string, () => void>();
    private keepAlive: (() => void) | null = null;
    private report: any | null;
    private taskExecutor = createDefaultTaskExecutor('subscriptions-task-executor', 10, 50);

    constructor(readonly params: SpaceXSessionParams) {
        this.descriptor = params.descriptor;
        this.schema = params.schema;
        Metrics.SpaceXSessions.inc();
        if (this.descriptor.type === 'authenticated') {
            Metrics.SpaceXSessionsAuthenticated.inc();
        } else if (this.descriptor.type === 'anonymnous') {
            Metrics.SpaceXSessionsAnonymous.inc();
        }

        // Keep session in memory until explicitly closed to avoid
        // invalid metrics
        activeSessions.set(this.uuid, this);

        // Resolve concurrency pool
        this.concurrencyPool = UnboundedConcurrencyPool;

        // Resolve keep alive
        if (params.descriptor.type === 'authenticated') {
            const uid = params.descriptor.uid;
            this.keepAlive = Modules.Events.userService.enableKeepAlive(uid);
            this.report = setInterval(() => {
                Metrics.OnlineConnected.add(1, 'uid-' + uid, 15000);
            }, 10000);
        }
    }

    operation(parentContext: Context, op: { raw: string, document: DocumentNode, variables: any, operationName?: string }, handler: (result: OpResult) => void): OpRef {
        if (this.closed) {
            throw Error('Session already closed');
        }
        let doc = getOperation(op.document, op.operationName);
        let docOp = doc.operation;
        let docField = getOperationField(doc);
        let id = uuid();
        let opContext = withLifetime(parentContext);
        opContext = SpaceXContext.set(opContext, true);
        let name = op.operationName ? docOp + '-' + op.operationName : '<unknown-' + docOp + '>';
        opContext = ContextName.set(opContext, name);
        let abort = () => {
            if (!isContextCancelled(opContext)) {
                cancelContext(opContext);
                handler({ type: 'aborted' });
            }
            if (this.activeOperations.has(id)) {
                if (docOp === 'subscription') {
                    Metrics.SpaceXSubscriptionsTagged.dec(op.operationName || '<unknown>');
                    Metrics.SpaceXSubscriptions.dec();
                } else {
                    Metrics.SpaceXOperations.dec();
                }
                this.activeOperations.delete(id);
            }
        };

        Metrics.SpaceXOperationsFrequence.inc();
        Metrics.SpaceXOperationsTaggedFrequence.inc(docOp);
        Metrics.SpaceXOperationsNamedFrequence.inc(name);
        this.activeOperations.set(id, abort);
        if (docOp === 'subscription') {
            Metrics.SpaceXSubscriptionsTagged.inc(op.operationName || '<unknown>');
            Metrics.SpaceXSubscriptions.inc();
        } else {
            Metrics.SpaceXOperations.inc();
        }
        const remote = resolveRemote(op.document);

        // tslint:disable-next-line:no-floating-promises
        (async () => {
            try {
                // We are doing check here to have a single place to throw errors
                if (docOp !== 'query' && docOp !== 'mutation' && docOp !== 'subscription') {
                    throw Error('Invalid operation type: ' + docOp);
                }

                //
                // Query / Mutation
                //

                if (docOp === 'query' || docOp === 'mutation') {

                    let res: InternalOpResult | null;
                    if (remote) {
                        // Execute in remote pool
                        res = await this._executeRemote(remote, {
                            ctx: opContext,
                            type: docOp,
                            op,
                            field: docField
                        });
                    } else {
                        // Executing in concurrency pool
                        let rr = await this._execute({
                            ctx: opContext,
                            type: docOp,
                            op,
                            field: docField
                        });
                        if (!rr) {
                            return;
                        }
                        if (rr.errors && rr.errors.length > 0) {
                            res = {
                                errors: rr.errors.map((v) => spaceFormatError(v))
                            };
                        } else {
                            res = {
                                data: rr.data
                            };
                        }
                    }

                    // Complete if is not already
                    if (!res) {
                        return;
                    }
                    if (isContextCancelled(opContext)) {
                        return;
                    }
                    cancelContext(opContext);

                    // This handlers could throw errors, but they are ignored since we are already 
                    // in completed state
                    if (isErrored(res)) {
                        handler({ type: 'errors', errors: res.errors });
                        handler({ type: 'completed' });
                    } else {
                        handler({ type: 'data', data: res.data });
                        handler({ type: 'completed' });
                    }
                } else {

                    // Subscription
                    let eventStream = await this._guard({ ctx: opContext, type: 'subscription', operationName: op.operationName, field: docField }, async (context) => {
                        return await createSourceEventStream(
                            this.schema,
                            op.document,
                            undefined /* Root Value */,
                            context,
                            op.variables,
                            op.operationName
                        );
                    });

                    // If already completed
                    if (!eventStream) {
                        return;
                    }
                    if (isContextCancelled(opContext)) {
                        return;
                    }

                    if (isAsyncIterator(eventStream)) {
                        if (isContextCancelled(opContext)) {
                            return;
                        }

                        // Iterate all events
                        for await (let event of eventStream) {

                            // Check if canceled
                            if (isContextCancelled(opContext)) {
                                return;
                            }

                            // Remove transaction and add new read one
                            let resolveContext = withoutTransaction(opContext);

                            // Execute
                            let resolved: InternalOpResult;
                            if (remote) {
                                resolved = await this._executeRemote(remote, {
                                    ctx: resolveContext,
                                    type: 'subscription-resolve',
                                    op,
                                    rootValue: event,
                                    field: docField
                                });
                            } else {
                                let executed = await this._execute({
                                    ctx: resolveContext,
                                    type: 'subscription-resolve',
                                    op,
                                    rootValue: event,
                                    field: docField
                                });
                                if (!executed) {
                                    return;
                                }
                                if (executed.errors && executed.errors.length > 0) {
                                    resolved = {
                                        errors: executed.errors.map((v) => spaceFormatError(v))
                                    };
                                } else {
                                    resolved = {
                                        data: executed.data
                                    };
                                }
                            }
                            Metrics.SpaceXSubscriptionEvents.inc();

                            // Check if canceled
                            if (isContextCancelled(opContext)) {
                                return;
                            }

                            // Handle event or error
                            if (isErrored(resolved)) {
                                cancelContext(opContext);
                                handler({ type: 'errors', errors: resolved.errors });
                                handler({ type: 'completed' });
                                break;
                            } else {
                                handler({ type: 'data', data: resolved.data });
                            }
                        }

                        if (!isContextCancelled(opContext)) {
                            cancelContext(opContext);
                            handler({ type: 'completed' });
                        }
                    } else {
                        // Weird branch. Probabbly just to handle errors.
                        if (!isContextCancelled(opContext)) {
                            cancelContext(opContext);
                            if (eventStream.errors && eventStream.errors.length > 0) {
                                handler({ type: 'errors', errors: [...eventStream.errors].map((v) => spaceFormatError(v)) });
                                handler({ type: 'completed' });
                            } else {
                                handler({ type: 'data', data: eventStream.data });
                                handler({ type: 'completed' });
                            }
                        }
                    }
                }
            } catch (e) {
                logger.warn(parentContext, e);
                Metrics.SpaceXOperationTaggedErrors.inc(name);
                if (isContextCancelled(opContext)) {
                    return;
                }
                cancelContext(opContext);
                handler({ type: 'errors', errors: [e] });
                handler({ type: 'completed' });
            } finally {
                // Cleanup
                if (!isContextCancelled(opContext)) {
                    cancelContext(opContext);
                }
                abort();
            }
        })();

        return {
            id,
            cancel: abort
        };
    }

    stopOperation(id: string) {
        let op = this.activeOperations.get(id);
        if (op) {
            op();
            this.activeOperations.delete(id);
        }
    }

    close() {
        if (this.closed) {
            return;
        }
        this.closed = true;
        activeSessions.delete(this.uuid);
        Metrics.SpaceXSessions.dec();
        if (this.keepAlive) {
            this.keepAlive();
            this.keepAlive = null;
        }
        if (this.report) {
            clearInterval(this.report);
            this.report = null;
        }
        if (this.descriptor.type === 'authenticated') {
            Metrics.SpaceXSessionsAuthenticated.dec();
        } else if (this.descriptor.type === 'anonymnous') {
            Metrics.SpaceXSessionsAnonymous.dec();
        }
        for (let op of [...this.activeOperations.values()]) {
            op();
        }
        if (Config.environment === 'debug') {
            logger.log(spaceXCtx, 'Session stopped');
        }
    }

    private async _executeRemote(remote: string, opts: {
        ctx: Context,
        rootValue?: any,
        type: 'mutation' | 'query' | 'subscription' | 'subscription-resolve',
        field: string | null,
        op: { raw: string, document: DocumentNode, variables: any, operationName?: string }
    }) {
        let start = currentRunningTime();
        let res = await tracer.trace(opts.ctx, 'remote-' + opts.type, async (context) => {
            if (opts.op.operationName) {
                setTracingTag(context, 'operation_name', opts.op.operationName);
            }
            if (context.auth.uid) {
                setTracingTag(context, 'user', IDs.User.serialize(context.auth.uid));
            }
            return await callRemoteQueryExecutor(remote,
                context,
                opts.op.raw,
                opts.op.variables,
                opts.op.operationName ? opts.op.operationName : null,
                opts.rootValue ? opts.rootValue : null
            );
        });
        let duration = currentRunningTime() - start;
        let tag = opts.type + ' ' + (opts.op.operationName || 'Unknown');
        if (opts.type === 'query' || opts.type === 'mutation') {
            Metrics.SpaceXOperationTime.report(duration);
            Metrics.SpaceXOperationTimeTagged.report(tag, duration);
        } else {
            Metrics.SpaceXOperationSubscriptionTime.report(duration);
            Metrics.SpaceXOperationSubscriptionTimeTagged.report(tag, duration);
        }

        return res;
    }

    private async _execute(opts: {
        ctx: Context,
        rootValue?: any,
        type: 'mutation' | 'query' | 'subscription' | 'subscription-resolve',
        field: string | null,
        op: { raw: string, document: DocumentNode, variables: any, operationName?: string }
    }) {
        return this._guard({ ctx: opts.ctx, type: opts.type, operationName: opts.op.operationName, field: opts.field }, async (context) => {
            let start = currentRunningTime();
            let ctx = context;

            let res: ExecutionResult<{
                [key: string]: any;
            }, {
                [key: string]: any;
            }>;
            switch (opts.type) {
                case 'subscription':
                    res = await execute(ctx, {
                        schema: this.schema,
                        document: opts.op.document,
                        operationName: opts.op.operationName,
                        variableValues: opts.op.variables,
                        contextValue: ctx,
                        rootValue: opts.rootValue
                    });
                    break;
                case 'subscription-resolve':

                    // Resolve executor
                    let executor = this.taskExecutor;
                    if (opts.field === 'typings') {
                        executor = typingsExecutor;
                    } else if (opts.field === 'chatOnlinesCount') {
                        executor = chatOnlineExecutor;
                    } else if (opts.field === 'alphaSubscribeOnline') {
                        executor = userOnlineExecutor;
                    }

                    // Execute
                    res = await executor.execute(async (ictx) => {
                        return execute(ictx, {
                            schema: this.schema,
                            document: opts.op.document,
                            operationName: opts.op.operationName,
                            variableValues: opts.op.variables,
                            contextValue: TransactionContext.set(ctx, TransactionContext.get(ictx)!),
                            rootValue: opts.rootValue
                        });
                    });
                    break;
                case 'query':
                    res = await inHybridTx(ctx, async (ictx) => {
                        getTransaction(ictx).setOptions({ retry_limit: 3, timeout: 10000 });
                        return execute(ictx, {
                            schema: this.schema,
                            document: opts.op.document,
                            operationName: opts.op.operationName,
                            variableValues: opts.op.variables,
                            contextValue: ictx,
                            rootValue: opts.rootValue
                        });
                    });
                    break;
                case 'mutation':
                    res = await inTx(ctx, async (ictx) => {
                        getTransaction(ictx).setOptions({ retry_limit: 3, timeout: 10000 });
                        return execute(ictx, {
                            schema: this.schema,
                            document: opts.op.document,
                            operationName: opts.op.operationName,
                            variableValues: opts.op.variables,
                            contextValue: ictx,
                            rootValue: opts.rootValue
                        });
                    });
                    break;
                default:
                    throw Error('Unknown ops type');
            }
            let duration = currentRunningTime() - start;
            let tag = opts.type + ' ' + (opts.op.operationName || 'Unknown');
            if (opts.type === 'query' || opts.type === 'mutation') {
                Metrics.SpaceXOperationTime.report(duration);
                Metrics.SpaceXOperationTimeTagged.report(tag, duration);
            } else {
                Metrics.SpaceXOperationSubscriptionTime.report(duration);
                Metrics.SpaceXOperationSubscriptionTimeTagged.report(tag, duration);
            }

            // Format responses
            return res;
        });
    }

    /**
     * Executes handler whitin tracer and concurrency pool
     * @param opts context, operation type and operation
     * @param handler
     */
    private async _guard<T>(opts: {
        ctx: Context,
        type: 'mutation' | 'query' | 'subscription' | 'subscription-resolve',
        field: string | null,
        operationName?: string
    }, handler: (context: Context) => Promise<T>): Promise<T | null> {
        if (isContextCancelled(opts.ctx)) {
            return null;
        }
        let res = await tracer.trace(opts.ctx, opts.type, async (context) => {
            if (opts.operationName) {
                setTracingTag(context, 'operation_name', opts.operationName);
            }
            if (opts.ctx.auth.uid) {
                setTracingTag(context, 'user', IDs.User.serialize(opts.ctx.auth.uid));
            }
            return await this.concurrencyPool.run(async () => {
                if (isContextCancelled(opts.ctx)) {
                    return null;
                }
                return await tracer.trace(context, 'run', async (context2) => {
                    return await handler(context2);
                });
            });
        });
        if (isContextCancelled(opts.ctx)) {
            return null;
        } else {
            return res;
        }
    }
}