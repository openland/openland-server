import { Context } from '@openland/context';
import { WriteToReadOnlyContextError } from '@openland/foundationdb';
import { createLogger } from '@openland/log';
import { FDBError } from 'foundationdb';
import { ExecutionResult, execute as nativeExecute } from 'graphql';
import { ExecutionArgs, ExecutionResultDataDefault } from 'graphql/execution/execute';
const logger = createLogger('graphql');

export async function execute(ctx: Context, args: ExecutionArgs): Promise<ExecutionResult<ExecutionResultDataDefault>> {
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