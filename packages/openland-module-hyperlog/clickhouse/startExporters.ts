import { Context } from '@openland/context';
import { Store } from 'openland-module-db/FDB';
import { updateReader } from 'openland-module-workers/updateReader';
import { DatabaseClient } from './ClickHouseClient';
import { createNamedContext } from '@openland/context';
import { backoff, forever, delay } from 'openland-utils/timer';
import { createClient } from './migrations';
import { HyperLog } from '../../openland-module-db/store';

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

function startSignupsExport(client: DatabaseClient) {
    updateReader('ch-exporter-signups', 1, Store.UserProfile.created.stream({ batchSize: 1000 }), async (src, first, ctx) => {
        let data: any[][] = [];
        for (let v of src) {
            let time = Math.round(v.metadata.createdAt / 1000);
            let uid = v.id;
            data.push([time, uid]);
        }
        await client.insert(ctx, 'signups', ['time', 'uid'], data);
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

function startAnalyticsExport(client: DatabaseClient) {
    updateReader('ch-analytics-exporter-reader', 1, Store.HyperLog.created.stream({ batchSize: 5000 }), async (src, first, ctx) => {
        // common fields: time, uid
        let simpleTypes = [
            'user_activated', 'new-mobile-user', 'new-sender',
            'new-about-filler', 'new-three-like-giver', 'new-three-like-getter'
        ];
        let complexTypes = ['new-inviter', 'new-reaction', 'call_ended'];

        let analyticsTypes = simpleTypes.concat(complexTypes);

        let eventsToIndex = src.filter((v) => analyticsTypes.includes(v.type) && (v.body.isTest === null || v.body.isTest === undefined || !v.body.isTest));
        if (eventsToIndex.length > 0) {
            let eventsByType = eventsToIndex.reduce((map, a) => {
                map.has(a.type) ? map.get(a.type)!.push(a) : map.set(a.type, [a]);
                return map;
            }, new Map<string, HyperLog[]>());
            for (let [type, values] of eventsByType.entries()) {
                let clickhouseTableName = type.replace(/-/g, '_');
                if (simpleTypes.includes(type)) {
                    await client.insert(ctx, clickhouseTableName, ['time', 'uid'], values.map((v) => [Math.round(v.date / 1000), v.body.uid]));
                }
                if (type === 'new-inviter') {
                    await client.insert(
                        ctx,
                        clickhouseTableName,
                        ['time', 'uid', 'invitee_id'],
                        values.map((v) => [Math.round(v.date / 1000), v.body.uid, v.body.inviteeId])
                    );
                }
                if (type === 'new-reaction') {
                    await client.insert(
                        ctx,
                        'reaction',
                        ['time', 'id', 'uid', 'mid', 'message_author_id'],
                        values.map((v) => [Math.round(v.date / 1000), v.id, v.body.uid, v.body.mid, v.body.messageAuthorId])
                    );
                }
                if (type === 'call_ended') {
                    await client.insert(
                        ctx,
                        'call_ended',
                        ['time', 'duration', 'id'],
                        values.map((v) => [Math.round(v.date / 1000), v.body.duration, v.id])
                    );
                }
            }
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
        startSignupsExport(client);
        startAnalyticsExport(client);
    })();
}