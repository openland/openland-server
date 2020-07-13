import { Context } from '@openland/context';
import { Store } from 'openland-module-db/FDB';
import { updateReader } from 'openland-module-workers/updateReader';
import { createNamedContext } from '@openland/context';
import { forever, delay } from 'openland-utils/timer';
import { HyperLog, HyperLogEvent } from '../openland-module-db/store';
import { container } from '../openland-modules/Modules.container';
import DatabaseClient from './DatabaseClient';
import { table, TableSpace } from './TableSpace';
import { boolean, date, integer, schema } from './schema';
import { subspaceReader } from '../openland-module-workers/subspaceReader';
import { encoders } from '@openland/foundationdb';

function startPresenceExport(client: DatabaseClient) {
    updateReader('ch-exporter-reader', 3, Store.HyperLog.created.stream({ batchSize: 5000 }), async (src, first, ctx) => {
        let presences = src.filter((v) => v.type === 'presence' && v.body.online === true);
        if (presences.length > 0) {
            await client.insert(ctx, 'presences', ['time', 'eid', 'uid', 'platform'], presences.map((v) => [Math.round(v.date / 1000), v.id, v.body.uid, v.body.platform]));
        }
    });
}

function startMessagesExport(client: DatabaseClient) {
    updateReader('ch-exporter-messages', 1, Store.Message.created.stream({ batchSize: 1000 }), async (src, first, ctx) => {
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

function startHyperlogExport(client: DatabaseClient) {
    updateReader('clickhouse-hyperlog-modern', 1, Store.HyperLogStore.createStream({ batchSize: 5000 }), async (src, first, ctx) => {
        let eventsByType = src.reduce<Map<string, HyperLogEvent[]>>((acc, val) => {
            let event = val.raw as HyperLogEvent;
            if (!acc.has(event.eventType)) {
                acc.set(event.eventType, [event]);
            } else {
                acc.get(event.eventType)!.push(event);
            }
            return acc;
        }, new Map<string, HyperLogEvent[]>());

        for (let [type, values] of eventsByType.entries()) {
            let t = TableSpace.get(type);
            await t.insert(ctx, client, values.map(a => ({ id: a.id, date: a.date, ...a.body })));
        }
    });
}

const orgUsers = table('org_users', schema({
    uid: integer(),
    oid: integer(),
    deleted: boolean(),
    sign: integer('Int8'),
}), {
    engine: 'CollapsingMergeTree(sign)',
    orderBy: '(oid, uid)',
    partition: 'oid',
    primaryKey: '(oid, uid)'
});
function startOrgUsersExport(client: DatabaseClient) {
    // Now only for mesto ¯\_(ツ)_/¯
    updateReader('clickhouse-org-users-exporter-joined', 1, Store.OrganizationMember.organization.stream('joined', 11954, { batchSize: 100 }), async (src, first, ctx) => {
        await orgUsers.insert(ctx, client, src.map(a => ({
            uid: a.uid,
            oid: a.oid,
            deleted: false,
            sign: 1,
        })));
    });
}

const presencesModern = table('presences_modern', schema({
    date: date(),
    uid: integer(),
    platform: integer('UInt8') // 0 - undefined, 1 - web, 2 - ios, 3 - android, 4 - desktop
}), { partition: 'toYYYYMM(date)', orderBy: '(date, uid)', primaryKey: '(date, uid)' });
function startModernPresenceExport(client: DatabaseClient) {
    subspaceReader<Buffer>('presence_log_reader', 2, 1000, Store.PresenceLogDirectory.withKeyEncoding(encoders.tuple), async (values, first, ctx) => {
        let src = values.map(a => ({ date: a.key[0] as number, uid: a.key[1] as number, platform: a.key[2] as number || 0 }));
        await presencesModern.insert(ctx, client, src);
        return Math.round((Date.now() - src[src.length - 1].date) / 1000);
    });
}

export function startExporters(parent: Context) {
    // tslint:disable-next-line:no-floating-promises
    (async () => {
        let client = container.get<DatabaseClient>('ClickHouse');
        startPresenceExport(client);
        startMessagesExport(client);
        startSuperAdminsExport(client);
        startBotsExport(client);
        startSignupsExport(client);
        startAnalyticsExport(client);
        startHyperlogExport(client);
        startOrgUsersExport(client);
        startModernPresenceExport(client);
    })();
}