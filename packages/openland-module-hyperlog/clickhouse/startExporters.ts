import { Store } from 'openland-module-db/FDB';
import { updateReader } from 'openland-module-workers/updateReader';
import { DatabaseClient } from './ClickHouseClient';
import { Context } from '@openland/context';
import { backoff } from 'openland-utils/timer';
import { createClient } from './migrations';

function startSimpleExport(client: DatabaseClient) {
    updateReader('ch-exporter-reader', 3, Store.HyperLog.created.stream(), async (src, first, ctx) => {
        let presences = src.filter((v) => v.type === 'presence' && v.body.online === true);
        if (presences.length > 0) {
            await client.insert(ctx, 'presences', ['time', 'eid', 'uid', 'platform'], src.map((v) => [Math.round(v.date / 1000), v.id, v.body.uid, v.body.platform]));
        }
    });
}

export function startExporters(ctx: Context) {
    // tslint:disable-next-line:no-floating-promises
    (async () => {
        let client = await backoff(ctx, () => createClient(ctx));
        startSimpleExport(client);
    })();
}