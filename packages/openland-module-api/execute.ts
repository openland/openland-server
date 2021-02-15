import { WriteToReadOnlyContextError } from '@openland/foundationdb';
import { FDBError } from 'foundationdb';
import { ExecutionResult, execute as nativeExecute } from 'graphql';
import { ExecutionArgs, ExecutionResultDataDefault } from 'graphql/execution/execute';

export async function execute(args: ExecutionArgs): Promise<ExecutionResult<ExecutionResultDataDefault>> {
    // Perform basic execution
    let res = await nativeExecute(args);

    // Forward FDB errors if needed
    if (res.errors) {
        for (let e of res.errors) {
            if (e.originalError instanceof WriteToReadOnlyContextError) {
                throw e.originalError;
            }
            if (e.originalError instanceof FDBError) {
                throw e.originalError;
            }
        }
    }

    // Result
    return res;
}