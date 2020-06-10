import http from 'http';
import https from 'https';
import { GraphQLSchema } from 'graphql';
import { QueryCache } from '../openland-mtproto3/queryCache';
import { Context } from '@openland/context';

export interface GQlServerOperation {
    name: string | undefined;
    variables: any;
    query: string;
}

export interface SpaceXServerParams {
    server?: http.Server | https.Server;
    path?: string;
    executableSchema: GraphQLSchema;
    queryCache?: QueryCache;

    onAuth(payload: any, req: http.IncomingMessage): Promise<any>;

    context(params: any, operation: GQlServerOperation, req: http.IncomingMessage): Promise<Context>;

    subscriptionContext(params: any, operation: GQlServerOperation, req: http.IncomingMessage): Promise<Context>;

    formatResponse(response: any, operation: GQlServerOperation, context: Context): any;

    onOperation(ctx: Context, operation: GQlServerOperation): Promise<void>;

    onOperationFinish(ctx: Context, operation: GQlServerOperation, duration: number): void;

    onEventResolveFinish(ctx: Context, operation: GQlServerOperation, duration: number): Promise<any>;
}