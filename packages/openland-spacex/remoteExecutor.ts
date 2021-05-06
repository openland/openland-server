import { createTracer } from 'openland-log/createTracer';
import { DocumentNode } from '@apollo/client/core';
import { Context, createNamedContext } from '@openland/context';
import { getTransaction, inTx } from '@openland/foundationdb';
import { Modules } from 'openland-modules/Modules';
import { contextParse, contextSerialize } from 'openland-server/context';
import { execute } from '../openland-module-api/execute';
import { spaceFormatError } from './spaceFormatError';
import { SpaceXFormattedError } from './SpaceXSession';

const tracer = createTracer('remote');

export function declareRemoteQueryExecutor(tag: string) {
    const rootCtx = createNamedContext('graphql-' + tag);
    const tracerExecutor = createTracer('executor-' + tag);
    Modules.Broker.createService({
        name: 'graphql-' + tag,
        actions: {
            execute: async (args) => {
                // Resolve context
                const parent = contextParse(rootCtx, (args.params.ctx as string));
                const op = args.params.query as string;
                const opName = args.params.operationName as string | null;
                const variables = args.params.variables as any;
                const query = Modules.API.queryResolver.resolve(op);
                const rootValue = (args.params.rootValue as any) || null;
                if (Array.isArray(query)) {
                    // TODO: Implement
                    // return {
                    //     errors: query.map((e: any) => formatError(e))
                    // };
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
                        return {
                            errors: res.errors.map((e) => spaceFormatError(e))
                        };
                    }
                    return {
                        data: res.data
                    };
                });
            }
        }
    });
}

export function callRemoteQueryExecutor(tag: string, ctx: Context, query: string, variables: any, operationName: string | null, rootValue: any | null): Promise<{ data: any } | { errors: SpaceXFormattedError[] }> {
    return tracer.trace(ctx, operationName ? operationName : '<call>', async (ctx2) => {
        return await Modules.Broker.call('graphql-' + tag + '.execute', { ctx: contextSerialize(ctx2), query, operationName, variables, rootValue }, { timeout: 10000 });
    });
}