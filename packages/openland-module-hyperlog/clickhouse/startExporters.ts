import { ClickHouseClient } from './ClickHouseClient';
import { Context } from '@openland/context';
import { backoff } from 'openland-utils/timer';
import { createClient } from './migrations';

function startSimpleExport(client: ClickHouseClient) {
    // TODO: Implement
}

export function startExporters(ctx: Context) {
    // tslint:disable-next-line:no-floating-promises
    (async () => {
        let client = await backoff(ctx, () => createClient(ctx));
        startSimpleExport(client);
    })();
}