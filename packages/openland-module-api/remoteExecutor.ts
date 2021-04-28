import { DocumentNode } from '@apollo/client/core';
import { Context, createNamedContext } from '@openland/context';
import { getTransaction, inTx } from '@openland/foundationdb';
import { ExecutionResult } from 'graphql';
import { Modules } from 'openland-modules/Modules';
import { contextParse, contextSerialize } from 'openland-server/context';
import { getOperation } from 'openland-spacex/utils/getOperation';
import { execute } from './execute';

export function declareRemoteQueryExecutor(tag: string) {
    const rootCtx = createNamedContext('graphql-' + tag);
    Modules.Broker.createService({
        name: 'graphql.' + tag,
        actions: {
            execute: async (args) => {
                // Resolve context
                const ctx = contextParse(rootCtx, (args.params.ctx as string));
                const op = args.params.query as string;
                const opName = args.params.operationName as string | null;
                const variables = args.params.variables as any;
                const query = Modules.API.queryResolver.resolve(op);
                if (Array.isArray(query)) {
                    // TODO: Implement
                    // return {
                    //     errors: query.map((e: any) => formatError(e))
                    // };
                    throw Error('Unknwon error');
                }

                // Resolve operation
                const doc = (query as any).document as DocumentNode; /* TS, WTF? */
                let operation = getOperation((query as any).document /* TS, WTF? */, opName ? opName : undefined);
                if (operation.operation === 'subscription') {
                    throw Error('Subscriptions are not supported');
                }

                // Execute
                const res = await inTx(ctx, async (ictx) => {
                    getTransaction(ictx).setOptions({ retry_limit: 3, timeout: 10000 });
                    return execute(ictx, {
                        schema: Modules.API.schema,
                        document: doc,
                        operationName: opName,
                        variableValues: variables,
                        contextValue: ictx,
                    });
                });

                if (res.errors && res.errors.length > 0) {
                    // TODO: Handle
                    throw Error('Unknwon error');
                }

                return res.data;
            }
        }
    });
}

export async function callRemoteQueryExecutor(tag: string, ctx: Context, query: string, variables: any, operationName: string | null): Promise<ExecutionResult> {
    return {
        data: await Modules.Broker.call('graphql.' + tag, { ctx: contextSerialize(ctx), query, operationName, variables })
    };
}