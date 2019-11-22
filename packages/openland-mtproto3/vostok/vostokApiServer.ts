import * as http from 'http';
import * as https from 'https';
import { execute, GraphQLSchema, parse } from 'graphql';
import { QueryCache } from '../queryCache';
import { Context } from '@openland/context';
import { initVostokServer, VostokIncomingMessage } from './vostokServer';
import {
    isGQLRequest,
    isGQLSubscription, isGQLSubscriptionStop,
    makeGQLResponse, makeGQLSubscriptionComplete,
    makeGQLSubscriptionResponse
} from '../vostok-schema/VostokTypes';
import { asyncRun, isAsyncIterator } from '../utils';
import { gqlSubscribe } from '../gqlSubscribe';
import { cancelContext } from '@openland/lifetime';

interface GQlOperation {
    operationName: string|null|undefined;
    variables: any;
    query: string;
}

interface VostokApiServerParams {
    server?: http.Server | https.Server;
    path: string;
    executableSchema: GraphQLSchema;
    queryCache?: QueryCache;

    onAuth(token: string): Promise<any>;

    context(params: any, operation: GQlOperation): Promise<Context>;

    subscriptionContext(params: any, operation: GQlOperation, firstCtx?: Context): Promise<Context>;

    formatResponse(response: any): Promise<any>;

    onOperation(ctx: Context, operation: GQlOperation): Promise<any>;
}

async function handleMessage(params: VostokApiServerParams, msg: VostokIncomingMessage) {
    let {message, session} = msg;

    if (isGQLRequest(message.body)) {
        session.sendAck([message.id]);
        let ctx = await params.context(session.authParams, message.body);
        await params.onOperation(ctx, message.body);

        let result = await execute({
            schema: params.executableSchema,
            document: parse(message.body.query),
            operationName: message.body.operationName,
            variableValues: message.body.variables ? JSON.parse(message.body.variables) : undefined,
            contextValue: ctx
        });
        session.send(makeGQLResponse({ id: message.body.id, result: await params.formatResponse(result) }), [], message.id);
    } else if (isGQLSubscription(message.body)) {
        session.sendAck([message.id], [message.id]);
        let working = true;
        let ctx = await params.subscriptionContext(session.authParams, message.body);
        asyncRun(async () => {
            if (!isGQLSubscription(message.body)) {
                return;
            }
            await params.onOperation(ctx, message.body);

            let iterator = await gqlSubscribe({
                schema: params.executableSchema,
                document: parse(message.body.query),
                operationName: message.body.operationName,
                variableValues: message.body.variables ? JSON.parse(message.body.variables) : undefined,
                fetchContext: async () => await params.subscriptionContext(session.authParams, message.body as any, ctx),
                ctx
            });

            if (!isAsyncIterator(iterator)) {
                // handle error
                session.send(makeGQLSubscriptionResponse({ id: message.body.id, result: JSON.stringify(await params.formatResponse(iterator)) }));
                return;
            }

            for await (let event of iterator) {
                if (!working) {
                    break;
                }
                session.send(makeGQLSubscriptionResponse({ id: message.body.id, result: await params.formatResponse(event) }));
            }
            session.send(makeGQLSubscriptionComplete({ id: message.body.id }));
        });
        session.operations.add(message.body.id, () => {
            working = false;
            cancelContext(ctx);
        });
    } else if (isGQLSubscriptionStop(message.body)) {
        session.operations.stop(message.body.id);
        session.sendAck([message.id], [message.id]);
    }
}

export function initVostokApiServer(params: VostokApiServerParams) {
    let server = initVostokServer({
        server: params.server,
        path: params.path,
        onAuth: params.onAuth,
        onMessage: msg => handleMessage(params, msg)
    });

    return server;
}