import * as http from 'http';
import * as https from 'https';
import { GraphQLSchema, parse } from 'graphql';
import { QueryCache } from '../queryCache';
import { Context } from '@openland/context';
import { initVostokTCPServer, initVostokWSServer, VostokIncomingMessage } from '../vostok/vostokServer';
import { asyncRun, isAsyncIterator } from '../utils';
import { gqlSubscribe } from '../gqlSubscribe';
import { cancelContext } from '@openland/lifetime';
import { vostok_api } from './schema/schema';
import { execute } from 'openland-module-api/execute';

interface GQlOperation {
    operationName?: string | null | undefined;
    variables?: any;
    query: string;
}

export const VostokApiTypes = {
    GQLRequest: 3,
    GQLResponse: 4,
    GQLSubscription: 5,
    GQLSubscriptionStop: 6,
    GQLSubscriptionResponse: 7,
    GQLSubscriptionComplete: 8,
    GQLCachedQueryNotFound: 9,
};

const makeGQLCachedQueryNotFound = (requestId: string) => ({
    bodyType: VostokApiTypes.GQLCachedQueryNotFound,
    body: vostok_api.GQLCachedQueryNotFound.encode({ id: requestId }).finish()
});

type Operation = { name: string | undefined, query: string, variables: string | undefined };

async function handleMessage(params: BaseVostokApiServerParams, msg: VostokIncomingMessage) {
    let { message, session } = msg;

    if (message.bodyType === VostokApiTypes.GQLRequest) {
        let request = vostok_api.GQLRequest.decode(message.body);
        session.sendAck([message.id]);

        if (!request.queryId && !request.query) {
            session.send(makeGQLCachedQueryNotFound(request.id));
            return;
        }
        let operation: Operation;
        if (request.queryId && request.queryId.length > 0) {
            if (!params.queryCache) {
                session.send(makeGQLCachedQueryNotFound(request.id));
                return;
            }
            let cachedQuery = await params.queryCache.get(request.queryId);
            if (!cachedQuery) {
                session.send(makeGQLCachedQueryNotFound(request.id));
                return;
            }
            operation = { ...cachedQuery, variables: (request.variables.length > 0 ? request.variables : undefined) };
        } else {
            operation = {
                query: request.query,
                variables: (request.variables.length > 0 ? request.variables : undefined),
                name: (request.operationName.length > 0 ? request.operationName : undefined)
            };
            if (params.queryCache) {
                await params.queryCache.store({ query: operation.query, name: operation.name });
            }
        }

        let ctx = await params.context(session.authParams, request);
        await params.onOperation(ctx, request);

        let result = await execute(ctx, {
            schema: params.executableSchema,
            document: parse(operation.query),
            operationName: operation.name,
            variableValues: operation.variables ? JSON.parse(operation.variables) : undefined,
            contextValue: ctx
        });
        session.send({
            bodyType: VostokApiTypes.GQLResponse,
            body: vostok_api.GQLResponse.encode({
                id: request.id,
                result: JSON.stringify(await params.formatResponse(result, request, ctx))
            }).finish()
        }, [], message.id);
    } else if (message.bodyType === VostokApiTypes.GQLSubscription) {
        let request = vostok_api.GQLSubscription.decode(message.body);
        session.sendAck([message.id], [message.id]);

        if (!request.queryId && !request.query) {
            session.send(makeGQLCachedQueryNotFound(request.id));
            return;
        }

        let operation: Operation;
        if (request.queryId && request.queryId.length > 0) {
            if (!params.queryCache) {
                session.send(makeGQLCachedQueryNotFound(request.id));
                return;
            }
            let cachedQuery = await params.queryCache.get(request.queryId);
            if (!cachedQuery) {
                session.send(makeGQLCachedQueryNotFound(request.id));
                return;
            }
            operation = { ...cachedQuery, variables: (request.variables.length > 0 ? request.variables : undefined) };
        } else {
            operation = {
                query: request.query,
                variables: (request.variables.length > 0 ? request.variables : undefined),
                name: (request.operationName.length > 0 ? request.operationName : undefined)
            };
            if (params.queryCache) {
                await params.queryCache.store({ query: operation.query, name: operation.name });
            }
        }

        let working = true;
        let ctx = await params.subscriptionContext(session.authParams, request);
        asyncRun(async () => {
            if (!request) {
                return;
            }
            await params.onOperation(ctx, request);

            let iterator = await gqlSubscribe({
                schema: params.executableSchema,
                document: parse(operation.query),
                operationName: operation.name,
                variableValues: operation.variables ? JSON.parse(operation.variables) : undefined,
                fetchContext: async () => await params.subscriptionContext(session.authParams, request, ctx),
                ctx,
                onEventResolveFinish: duration => {
                    // noop
                }
            });

            if (!isAsyncIterator(iterator)) {
                // handle error
                session.send({
                    bodyType: VostokApiTypes.GQLSubscriptionResponse,
                    body: vostok_api.GQLSubscriptionResponse.encode({
                        id: request.id,
                        result: JSON.stringify(await params.formatResponse(iterator, request, ctx))
                    }).finish()
                });
                return;
            }

            for await (let event of iterator) {
                if (!working) {
                    break;
                }
                session.send({
                    bodyType: VostokApiTypes.GQLSubscriptionResponse,
                    body: vostok_api.GQLSubscriptionResponse.encode({
                        id: request.id,
                        result: JSON.stringify(await params.formatResponse(event, request, ctx))
                    }).finish()
                });
            }
            session.send({
                bodyType: VostokApiTypes.GQLSubscriptionComplete,
                body: vostok_api.GQLSubscriptionComplete.encode({ id: request.id }).finish()
            });
        });
        session.operations.add(request.id, () => {
            working = false;
            cancelContext(ctx);
        });
    } else if (message.bodyType === VostokApiTypes.GQLSubscriptionStop) {
        let request = vostok_api.GQLSubscriptionStop.decode(message.body);
        session.operations.stop(request.id);
        session.sendAck([message.id], [message.id]);
    }
}

interface BaseVostokApiServerParams {
    executableSchema: GraphQLSchema;
    queryCache?: QueryCache;

    onAuth(token: string): Promise<any>;

    context(params: any, operation: GQlOperation): Promise<Context>;

    subscriptionContext(params: any, operation: GQlOperation, firstCtx?: Context): Promise<Context>;

    formatResponse(response: any, operation: GQlOperation, context: Context): Promise<any>;

    onOperation(ctx: Context, operation: GQlOperation): Promise<any>;
}

type VostokApiServerParams = BaseVostokApiServerParams & {
    server?: http.Server | https.Server;
    path: string;
};

export function initVostokApiServer(params: VostokApiServerParams) {
    let server = initVostokWSServer({
        server: params.server,
        path: params.path,
        onAuth: params.onAuth,
        onMessage: msg => handleMessage(params, msg)
    });

    return server;
}

type VostokTCPApiServerParams = BaseVostokApiServerParams & {
    port: number;
    hostname: string;
};

export function initVostokTCPApiServer(params: VostokTCPApiServerParams) {
    let server = initVostokTCPServer({
        port: params.port,
        hostname: params.hostname,
        onAuth: params.onAuth,
        onMessage: msg => handleMessage(params, msg)
    });

    return server;
}
