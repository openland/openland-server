import { sha256 } from './../openland-mtproto3/queryCache';
import { Context } from '@openland/context';
import { WriteToReadOnlyContextError } from '@openland/foundationdb';
import { createLogger } from '@openland/log';
import { FDBError } from 'foundationdb';
import { ExecutionResult, execute as nativeExecute } from 'graphql';
import { compileQuery, isCompiledQuery, CompiledQuery } from 'graphql-jit';
import { ExecutionArgs } from 'graphql/execution/execute';
import { Config } from 'openland-config/Config';
const logger = createLogger('graphql');
const jitCache = new Map<string, CompiledQuery>();

export async function execute(ctx: Context, args: ExecutionArgs): Promise<ExecutionResult> {

    // Try to use jit
    if (Config.enableGraphqlJit) {
        const queryHash = sha256(JSON.stringify(args.document));
        if (jitCache.has(queryHash)) {
            const compiled = jitCache.get(queryHash)!;
            return compiled.query(args.rootValue, args.contextValue, args.variableValues);
        } else {
            const compiled = compileQuery(args.schema, args.document, args.operationName ? args.operationName : undefined);
            if (isCompiledQuery(compiled)) {
                jitCache.set(queryHash, compiled);
                return compiled.query(args.rootValue, args.contextValue, args.variableValues);
            } else {
                return compiled;
            }
        }
    }

    // Perform basic execution
    let res = await nativeExecute(args);

    // Forward FDB errors if needed
    if (res.errors) {
        for (let e of res.errors) {
            if (e.originalError instanceof WriteToReadOnlyContextError) {
                logger.warn(ctx, e.originalError);
                throw e.originalError;
            }
            if (e.originalError instanceof FDBError) {
                logger.warn(ctx, e.originalError);
                throw e.originalError;
            }
        }
    }

    // Result
    return res;
}