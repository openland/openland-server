import { Store } from 'openland-module-db/FDB';
import { updateReader } from 'openland-module-workers/updateReader';
import { DatabaseClient } from './ClickHouseClient';
import { Context } from '@openland/context';
import { backoff } from 'openland-utils/timer';
import { createClient } from './migrations';

function startPresenceExport(client: DatabaseClient) {
    updateReader('ch-exporter-reader', 3, Store.HyperLog.created.stream({ batchSize: 5000 }), async (src, first, ctx) => {
        let presences = src.filter((v) => v.type === 'presence' && v.body.online === true);
        if (presences.length > 0) {
            await client.insert(ctx, 'presences', ['time', 'eid', 'uid', 'platform'], src.map((v) => [Math.round(v.date / 1000), v.id, v.body.uid, v.body.platform]));
        }
    });
}

function startMessagesExport(client: DatabaseClient) {
    updateReader('ch-exporter-messages', 1, Store.Message.updated.stream({ batchSize: 1000 }), async (src, first, ctx) => {

        let data: any[][] = [];
        for (let v of src) {
            let time = Math.round(v.metadata.createdAt / 1000);
            let id = v.id.toString();
            let uid = v.uid;
            let type = 'unknwon';
            if (v.text) {
                type = 'text';
            }
            let service = 0;
            if (v.isService) {
                service = 1;
            }
            data.push([time, id, uid, type, service]);
        }
        await client.insert(ctx, 'messages', ['time', 'id', 'uid', 'type', 'service'], data);
    });
}

export function startExporters(ctx: Context) {
    // tslint:disable-next-line:no-floating-promises
    (async () => {
        let client = await backoff(ctx, () => createClient(ctx));
        startPresenceExport(client);
        startMessagesExport(client);
    })();
}