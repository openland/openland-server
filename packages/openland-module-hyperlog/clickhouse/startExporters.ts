import { Store } from 'openland-module-db/FDB';
import { updateReader } from 'openland-module-workers/updateReader';
import { DatabaseClient } from './ClickHouseClient';
import { Context, createNamedContext } from '@openland/context';
import { backoff, forever, delay } from 'openland-utils/timer';
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

function startSuperAdminsExport(client: DatabaseClient) {
    let rootCtx = createNamedContext('ch-users-export');
    forever(rootCtx, async () => {
        while (true) {
            // NOTE: In analytics we are not resetting super admin flag
            //       and always treat ex-admins as super admins to remove them 
            //       from our reports
            let superAdmins = await Store.SuperAdmin.findAll(rootCtx);
            for (let u of superAdmins) {
                let count = await client.count(rootCtx, 'admins', 'uid = ' + u.id);
                if (count === 0) {
                    await client.insert(rootCtx, 'admins', ['uid'], [[u.id]]);
                }
            }
            await delay(15000);
        }
    });
}

function startBotsExport(client: DatabaseClient) {
    let rootCtx = createNamedContext('ch-bots-export');
    forever(rootCtx, async () => {
        while (true) {
            let allUsers = await Store.User.findAll(rootCtx);
            for (let u of allUsers) {
                if (!u.isBot) {
                    continue;
                }
                let count = await client.count(rootCtx, 'bots', 'uid = ' + u.id);
                if (count === 0) {
                    await client.insert(rootCtx, 'bots', ['uid'], [[u.id]]);
                }
            }
            await delay(15000);
        }
    });
}

export function startExporters(ctx: Context) {
    // tslint:disable-next-line:no-floating-promises
    (async () => {
        let client = await backoff(ctx, () => createClient(ctx));
        startPresenceExport(client);
        startMessagesExport(client);
        startSuperAdminsExport(client);
        startBotsExport(client);
    })();
}