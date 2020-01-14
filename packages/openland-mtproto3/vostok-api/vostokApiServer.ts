import * as http from 'http';
import * as https from 'https';
import { execute, GraphQLSchema, parse } from 'graphql';
import { QueryCache } from '../queryCache';
import { Context } from '@openland/context';
import { initVostokTCPServer, initVostokWSServer, VostokIncomingMessage } from '../vostok/vostokServer';
import { asyncRun, isAsyncIterator } from '../utils';
import { gqlSubscribe } from '../gqlSubscribe';
import { cancelContext } from '@openland/lifetime';
import { vostok_api } from './schema/schema';

interface GQlOperation {
    operationName?: string | null | undefined;
    variables?: any;
    query: string;
}

export const VostokApiTypeUrls = {
    GQLRequest: 'type.googleapis.com/vostok_api.GQLRequest',
    GQLResponse: 'type.googleapis.com/vostok_api.GQLResponse',
    GQLSubscription: 'type.googleapis.com/vostok_api.GQLSubscription',
    GQLSubscriptionStop: 'type.googleapis.com/vostok_api.GQLSubscriptionStop',
    GQLSubscriptionResponse: 'type.googleapis.com/vostok_api.GQLSubscriptionResponse',
    GQLSubscriptionComplete: 'type.googleapis.com/vostok_api.GQLSubscriptionComplete',
};

async function handleMessage(params: BaseVostokApiServerParams, msg: VostokIncomingMessage) {
    let {message, session} = msg;

    if (message.body.type_url === VostokApiTypeUrls.GQLRequest) {
        let request = vostok_api.GQLRequest.decode(message.body.value!);
        session.sendAck([message.id]);
        let ctx = await params.context(session.authParams, request);
        await params.onOperation(ctx, request);

        let result = await execute({
            schema: params.executableSchema,
            document: parse(request.query),
            operationName: request.operationName,
            variableValues: request.variables ? JSON.parse(request.variables) : undefined,
            contextValue: ctx
        });
        session.send({
            body: {
                type_url: VostokApiTypeUrls.GQLResponse,
                value: vostok_api.GQLResponse.encode({
                    id: request.id,
                    result: JSON.stringify(await params.formatResponse(result, request, ctx))
                }).finish()
            }
        }, [], message.id);
    } else if (message.body.type_url === VostokApiTypeUrls.GQLSubscription) {
        let request = vostok_api.GQLSubscription.decode(message.body.value!);
        session.sendAck([message.id], [message.id]);
        let working = true;
        let ctx = await params.subscriptionContext(session.authParams, request);
        asyncRun(async () => {
            if (!request) {
                return;
            }
            await params.onOperation(ctx, request);

            let iterator = await gqlSubscribe({
                schema: params.executableSchema,
                document: parse(request.query),
                operationName: request.operationName,
                variableValues: request.variables ? JSON.parse(request.variables) : undefined,
                fetchContext: async () => await params.subscriptionContext(session.authParams, request, ctx),
                ctx
            });

            if (!isAsyncIterator(iterator)) {
                // handle error
                session.send({
                    body: {
                        type_url: VostokApiTypeUrls.GQLSubscriptionResponse,
                        value: vostok_api.GQLSubscriptionResponse.encode({
                            id: request.id,
                            result: JSON.stringify(await params.formatResponse(iterator, request, ctx))
                        }).finish()
                    }
                });
                return;
            }

            for await (let event of iterator) {
                if (!working) {
                    break;
                }
                session.send({
                    body: {
                        type_url: VostokApiTypeUrls.GQLSubscriptionResponse,
                        value: vostok_api.GQLSubscriptionResponse.encode({
                            id: request.id,
                            result: JSON.stringify(await params.formatResponse(event, request, ctx))
                        }).finish()
                    }
                });
            }
            session.send({
                body: {
                    type_url: VostokApiTypeUrls.GQLSubscriptionComplete,
                    value: vostok_api.GQLSubscriptionComplete.encode({id: request.id}).finish()
                }
            });
        });
        session.operations.add(request.id, () => {
            working = false;
            cancelContext(ctx);
        });
    } else if (message.body.type_url === VostokApiTypeUrls.GQLSubscriptionStop) {
        let request = vostok_api.GQLSubscriptionStop.decode(message.body.value!);
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
