import { withReadOnlyTransaction, withoutTransaction } from '@openland/foundationdb';
import { createTracer } from 'openland-log/createTracer';
import { createLogger } from '@openland/log';
import { Config } from 'openland-config/Config';
import { ConcurrencyPool } from 'openland-utils/ConcurrencyPool';
import { Concurrency } from './../openland-server/concurrency';
import uuid from 'uuid/v4';
import { Metrics } from 'openland-module-monitoring/Metrics';
import { Context, createNamedContext } from '@openland/context';
import { DocumentNode, GraphQLSchema, execute, createSourceEventStream } from 'graphql';
import { getOperationType } from './utils/getOperationType';
import { setTracingTag } from 'openland-log/setTracingTag';
import { isAsyncIterator } from 'openland-mtproto3/utils';
import { isContextCancelled, withLifetime, cancelContext } from '@openland/lifetime';

export type SpaceXSessionDescriptor = { type: 'anonymnous' } | { type: 'authenticated', uid: number, tid: string };

export interface SpaceXSessionParams {
    descriptor: SpaceXSessionDescriptor;
    schema: GraphQLSchema;
}

export type OpResult = {
    type: 'data';
    data: any;
} | {
    type: 'errors';
    errors: any[];
} | {
    type: 'aborted';
} | {
    type: 'completed';
};

export type OpRef = {
    cancel: () => void;
};

let activeSessions = new Map<string, SpaceXSession>();
const spaceXCtx = createNamedContext('spacex');
const logger = createLogger('spacex');
const tracer = createTracer('spacex');

export class SpaceXSession {
    readonly uuid = uuid();
    readonly descriptor: SpaceXSessionDescriptor;
    private readonly schema: GraphQLSchema;
    private readonly concurrencyPool: ConcurrencyPool;
    private closed = false;
    private activeOperations = new Map<string, () => void>();

    constructor(params: SpaceXSessionParams) {
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
        if (this.descriptor.type === 'anonymnous') {
            this.concurrencyPool = Concurrency.Default;
        } else {
            this.concurrencyPool = Concurrency.Execution.get(this.descriptor.tid);

            if (Config.environment === 'debug') {
                logger.log(spaceXCtx, 'Session started');
            }
        }
    }

    operation(parentContext: Context, op: { document: DocumentNode, variables: any, operationName?: string }, handler: (result: OpResult) => void): OpRef {
        if (this.closed) {
            throw Error('Session already closed');
        }
        let id = uuid();
        const lifetime = withLifetime(parentContext);
        let abort = () => {
            if (!isContextCancelled(lifetime)) {
                cancelContext(lifetime);
                handler({ type: 'aborted' });
            }
            if (this.activeOperations.has(id)) {
                Metrics.SpaceXOperations.dec();
                this.activeOperations.delete(id);
            }
        };
        Metrics.SpaceXOperations.inc();
        Metrics.SpaceXOperationsFrequence.inc();
        this.activeOperations.set(id, abort);

        // tslint:disable-next-line:no-floating-promises
        (async () => {
            try {
                // We are doing check here to have a single place to throw errors
                let docOp = getOperationType(op.document, op.operationName);
                if (docOp !== 'query' && docOp !== 'mutation' && docOp !== 'subscription') {
                    throw Error('Invalid operation type: ' + docOp);
                }

                //
                // Query / Mutation
                //

                if (docOp === 'query' || docOp === 'mutation') {

                    // Executing in concurrency pool
                    let res = await this._execute({
                        ctx: lifetime,
                        type: docOp,
                        op
                    });

                    // Complete if is not already
                    if (!res) {
                        return;
                    }
                    if (isContextCancelled(lifetime)) {
                        return;
                    }
                    cancelContext(lifetime);

                    // This handlers could throw errors, but they are ignored since we are already 
                    // in completed state
                    if (res.errors && res.errors.length > 0) {
                        handler({ type: 'errors', errors: [...res.errors!] });
                        handler({ type: 'completed' });
                    } else {
                        handler({ type: 'data', data: res.data });
                        handler({ type: 'completed' });
                    }
                } else {

                    // Subscription
                    let eventStream = await this._guard({ ctx: lifetime, type: 'subscription', operationName: op.operationName }, async (context) => {
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
                    if (isContextCancelled(lifetime)) {
                        return;
                    }

                    if (isAsyncIterator(eventStream)) {
                        if (isContextCancelled(lifetime)) {
                            return;
                        }

                        // Iterate all events
                        for await (let event of eventStream) {

                            // Check if canceled
                            if (isContextCancelled(lifetime)) {
                                return;
                            }

                            // Remove transaction and add new read one
                            let resolveContext = withoutTransaction(lifetime);
                            resolveContext = withReadOnlyTransaction(resolveContext);

                            // Execute
                            let resolved = await this._execute({
                                ctx: resolveContext,
                                type: 'subscription-resolve',
                                op,
                                rootValue: event
                            });

                            // Check if canceled
                            if (!resolved) {
                                return;
                            }
                            if (isContextCancelled(lifetime)) {
                                return;
                            }

                            // Handle event or error
                            if (resolved.errors && resolved.errors.length > 0) {
                                cancelContext(lifetime);
                                handler({ type: 'errors', errors: [...resolved.errors!] });
                                handler({ type: 'completed' });
                                break;
                            } else {
                                handler({ type: 'data', data: resolved.data });
                            }
                        }

                        if (!isContextCancelled(lifetime)) {
                            cancelContext(lifetime);
                            handler({ type: 'completed' });
                        }
                    } else {
                        // Weird branch. Probabbly just to handle errors.
                        if (!isContextCancelled(lifetime)) {
                            cancelContext(lifetime);
                            if (eventStream.errors && eventStream.errors.length > 0) {
                                handler({ type: 'errors', errors: [...eventStream.errors!] });
                                handler({ type: 'completed' });
                            } else {
                                handler({ type: 'data', data: eventStream.data });
                                handler({ type: 'completed' });
                            }
                        }
                    }
                }
            } catch (e) {
                if (isContextCancelled(lifetime)) {
                    return;
                }
                cancelContext(lifetime);
                handler({ type: 'errors', errors: [e] });
                handler({ type: 'completed' });
            } finally {
                // Cleanup
                if (!isContextCancelled(lifetime)) {
                    cancelContext(lifetime);
                }
                abort();
            }
        })();

        return {
            cancel: abort
        };
    }

    close() {
        if (this.closed) {
            return;
        }
        this.closed = true;
        activeSessions.delete(this.uuid);
        Metrics.SpaceXSessions.dec();
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

    private async _execute(opts: {
        ctx: Context,
        rootValue?: any,
        type: 'mutation' | 'query' | 'subscription' | 'subscription-resolve',
        op: { document: DocumentNode, variables: any, operationName?: string }
    }) {
        return this._guard({ ctx: opts.ctx, type: opts.type, operationName: opts.op.operationName }, async (context) => {
            return await execute({
                schema: this.schema,
                document: opts.op.document,
                operationName: opts.op.operationName,
                variableValues: opts.op.variables,
                contextValue: context,
                rootValue: opts.rootValue
            });
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
        operationName?: string
    }, handler: (context: Context) => Promise<T>): Promise<T | null> {
        if (isContextCancelled(opts.ctx)) {
            return null;
        }
        let res = await tracer.trace(opts.ctx, opts.type, async (context) => {
            if (opts.operationName) {
                setTracingTag(context, 'operation_name', opts.operationName);
            }
            return await this.concurrencyPool.run(async () => {
                if (isContextCancelled(opts.ctx)) {
                    return null;
                }
                return handler(context);
            });
        });
        if (isContextCancelled(opts.ctx)) {
            return null;
        } else {
            return res;
        }
    }
}