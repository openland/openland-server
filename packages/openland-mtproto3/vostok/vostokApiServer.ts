import * as http from "http";
import * as https from "https";
import { GraphQLSchema } from 'graphql';
import { QueryCache } from '../queryCache';
import { Context } from '@openland/context';

interface GQlServerOperation {
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

    context(params: any, operation: GQlServerOperation): Promise<Context>;

    subscriptionContext(params: any, operation: GQlServerOperation, firstCtx?: Context): Promise<Context>;

    formatResponse(response: any): Promise<any>;

    onOperation(ctx: Context, operation: GQlServerOperation): Promise<any>;
}