import * as http from 'http';
import * as https from 'https';
import { execute, GraphQLSchema, parse } from 'graphql';
import { QueryCache } from '../queryCache';
import { Context } from '@openland/context';
import { initVostokServer, VostokIncomingMessage } from './vostokServer';
import { asyncRun, isAsyncIterator } from '../utils';
import { gqlSubscribe } from '../gqlSubscribe';
import { cancelContext } from '@openland/lifetime';
import { vostok } from './schema/schema';

interface GQlOperation {
    operationName?: string | null | undefined;
    variables?: any;
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

    if (message.gqlRequest) {
        session.sendAck([message.id]);
        let ctx = await params.context(session.authParams, message.gqlRequest);
        await params.onOperation(ctx, message.gqlRequest);

        let result = await execute({
            schema: params.executableSchema,
            document: parse(message.gqlRequest.query),
            operationName: message.gqlRequest.operationName,
            variableValues: message.gqlRequest.variables ? JSON.parse(message.gqlRequest.variables) : undefined,
            contextValue: ctx
        });
        session.send(vostok.Message.create({
            id: '',
            gqlResponse: {id: message.gqlRequest.id, result: JSON.stringify(await params.formatResponse(result))}
        }), [], message.id);
    } else if (message.gqlSubscription) {
        session.sendAck([message.id], [message.id]);
        let working = true;
        let ctx = await params.subscriptionContext(session.authParams, message.gqlSubscription);
        asyncRun(async () => {
            if (!message.gqlSubscription) {
                return;
            }
            await params.onOperation(ctx, message.gqlSubscription);

            let iterator = await gqlSubscribe({
                schema: params.executableSchema,
                document: parse(message.gqlSubscription.query),
                operationName: message.gqlSubscription.operationName,
                variableValues: message.gqlSubscription.variables ? JSON.parse(message.gqlSubscription.variables) : undefined,
                fetchContext: async () => await params.subscriptionContext(session.authParams, message.gqlSubscription as any, ctx),
                ctx
            });

            if (!isAsyncIterator(iterator)) {
                // handle error
                session.send(vostok.Message.create({
                    id: '',
                    gqlSubscriptionResponse: {
                        id: message.gqlSubscription.id,
                        result: JSON.stringify(await params.formatResponse(iterator))
                    }
                }));
                return;
            }

            for await (let event of iterator) {
                if (!working) {
                    break;
                }
                session.send(vostok.Message.create({
                    id: '',
                    gqlSubscriptionResponse: {
                        id: message.gqlSubscription.id,
                        result: JSON.stringify(await params.formatResponse(event))
                    }
                }));
            }
            session.send(vostok.Message.create({ id: '', gqlSubscriptionComplete: { id: message.gqlSubscription.id }}));
        });
        session.operations.add(message.gqlSubscription.id, () => {
            working = false;
            cancelContext(ctx);
        });
    } else if (message.gqlSubscriptionStop) {
        session.operations.stop(message.gqlSubscriptionStop.id);
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