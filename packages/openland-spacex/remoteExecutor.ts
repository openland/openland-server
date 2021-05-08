import { createLogger } from '@openland/log';
import { createTracer } from 'openland-log/createTracer';
import { DocumentNode } from '@apollo/client/core';
import { Context, createNamedContext } from '@openland/context';
import { getTransaction, inTx } from '@openland/foundationdb';
import { Modules } from 'openland-modules/Modules';
import { contextParse, contextSerialize } from 'openland-server/context';
import { execute } from '../openland-module-api/execute';
import { spaceFormatError } from './spaceFormatError';
import { SpaceXFormattedError } from './SpaceXSession';
import { createIterator } from 'openland-utils/asyncIterator';
import { RemoteTransport } from 'openland-module-pubsub/RemoteTransport';
import { createSourceEventStream } from 'graphql';
import { isAsyncIterator } from 'openland-mtproto3/utils';

const logger = createLogger('graphql');
const tracer = createTracer('remote');

type RemoteResponse = { data: any } | { errors: SpaceXFormattedError[] };

export function declareRemoteQueryExecutor(tag: string) {
    const rootCtx = createNamedContext('graphql-' + tag);
    const tracerExecutor = createTracer('executor-' + tag);
    Modules.Broker.createService({
        name: 'graphql-' + tag,
        actions: {
            execute: {
                bulkhead: {
                    enabled: true,
                    concurrency: 100,
                    maxQueueSize: 500,
                },
                handler: async (args) => {
                    // Resolve context
                    const parent = contextParse(rootCtx, (args.params.ctx as string));
                    const op = args.params.query as string;
                    const opName = args.params.operationName as string | null;
                    const variables = args.params.variables as any;
                    const query = Modules.API.queryResolver.resolve(op);
                    const rootValue = (args.params.rootValue as any) || null;
                    if (Array.isArray(query)) {
                        throw Error('Unknwon error');
                    }

                    return await tracerExecutor.trace(parent, opName ? opName : '<call>', async (ctx) => {

                        // Resolve operation
                        const doc = (query as any).document as DocumentNode; /* TS, WTF? */
                        // let operation = getOperation((query as any).document /* TS, WTF? */, opName ? opName : undefined);

                        // Execute
                        const res = await inTx(ctx, async (ictx) => {
                            getTransaction(ictx).setOptions({ retry_limit: 3, timeout: 10000 });
                            return execute(ictx, {
                                schema: Modules.API.schema,
                                document: doc,
                                operationName: opName,
                                variableValues: variables,
                                contextValue: ictx,
                                rootValue: rootValue ? rootValue : undefined
                            });
                        });

                        // Format response
                        if (res.errors && res.errors.length > 0) {

                            // Log errors
                            for (let e of res.errors) {
                                logger.error(ctx, e);
                            }

                            // Convert errors
                            return {
                                errors: res.errors.map((e) => spaceFormatError(e))
                            };
                        }
                        return {
                            data: res.data
                        };
                    });
                }
            },
            subscribe: {
                handler: async (args) => {
                    // Resolve context
                    const parent = contextParse(rootCtx, (args.params.ctx as string));
                    const op = args.params.query as string;
                    const opName = args.params.operationName as string | null;
                    const variables = args.params.variables as any;
                    const query = Modules.API.queryResolver.resolve(op);
                    const remoteId = args.params.transport as string;
                    if (Array.isArray(query)) {
                        throw Error('Unknwon error');
                    }
                    const doc = (query as any).document as DocumentNode; /* TS, WTF? */

                    // Create stream
                    const eventStream = await createSourceEventStream(
                        Modules.API.schema,
                        doc,
                        undefined /* Root Value */,
                        parent,
                        variables,
                        opName
                    );

                    // TODO: Handle better
                    if (!isAsyncIterator(eventStream)) {
                        throw Error('Unknwon error');
                    }

                    // Create transport
                    let closed = false;
                    const transport = new RemoteTransport({ client: Modules.NATS, keepAlive: 5000 });
                    transport.connect(remoteId);
                    transport.onClosed(() => {
                        closed = true;
                    });

                    // Start 
                    // tslint:disable-next-line:no-floating-promises
                    (async () => {
                        try {
                            for await (let event of eventStream) {
                                if (closed) {
                                    return;
                                }

                                // Resolve event
                                
                                const executed = await inTx(parent, async (ictx) => {
                                    getTransaction(ictx).setOptions({ retry_limit: 3, timeout: 10000 });
                                    return execute(ictx, {
                                        schema: Modules.API.schema,
                                        document: doc,
                                        operationName: opName,
                                        variableValues: variables,
                                        contextValue: ictx,
                                        rootValue: event
                                    });
                                });

                                if (executed.errors && executed.errors.length > 0) {
                                    // Log errors
                                    for (let e of executed.errors) {
                                        logger.error(parent, e);
                                    }

                                    // Convert errors
                                    transport.send({
                                        errors: executed.errors.map((e) => spaceFormatError(e))
                                    });
                                    return;
                                } else {
                                    transport.send({
                                        data: executed.data
                                    });
                                }
                            }
                        } finally {
                            // Close
                            if (!closed) {
                                closed = true;
                                transport.stop();
                            }
                        }
                    })();

                    return { id: transport.id };
                }
            }
        }
    });
}

export function callRemoteQueryExecutor(tag: string, ctx: Context, query: string, variables: any, operationName: string | null, rootValue: any | null): Promise<RemoteResponse> {
    return tracer.trace(ctx, operationName ? operationName : '<call>', async (ctx2) => {
        return await Modules.Broker.call('graphql-' + tag + '.execute', { ctx: contextSerialize(ctx2), query, operationName, variables, rootValue }, { timeout: 10000 });
    });
}

export async function callRemoteSubscription(tag: string, ctx: Context, query: string, variables: any, operationName: string | null): Promise<AsyncIterable<RemoteResponse>> {

    // Create iterator
    const iterator = createIterator<RemoteResponse>();

    // Create receiver transport
    const transport = new RemoteTransport({ client: Modules.NATS, keepAlive: 5000 });
    await transport.start();
    transport.onClosed(() => {
        iterator.complete();
    });
    transport.onMessage((data) => {
        iterator.push(data);
    });

    // Connect transport
    const result = await Modules.Broker.call<{ id: string }, any>('graphql-' + tag + '.subscribe', { transport: transport.id, ctx: contextSerialize(ctx), query, operationName, variables }, { timeout: 10000 });
    const connectId = result.id;
    transport.connect(connectId);

    // Handle iterator closing
    iterator.onExit = () => {
        transport.stop();
    };

    return iterator;
}