import { Context } from '@openland/context';
import { Store } from 'openland-module-db/FDB';
import { updateReader } from 'openland-module-workers/updateReader';
import { createNamedContext } from '@openland/context';
import { forever, delay } from 'openland-utils/timer';
import { HyperLogEvent } from '../openland-module-db/store';
import { container } from '../openland-modules/Modules.container';
import DatabaseClient from './DatabaseClient';
import { table, TableSpace } from './TableSpace';
import { boolean, date, integer, nullable, schema, string } from './schema';
import { subspaceReader } from '../openland-module-workers/subspaceReader';
import { encoders, inReadOnlyTx, inTx } from '@openland/foundationdb';

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
        let superAdmins = await inTx(rootCtx, async (ctx) => await Store.SuperAdmin.findAll(ctx));
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
    updateReader('ch-exporter-bots', 1, Store.User.created.stream({ batchSize: 1000 }), async (src, first, ctx) => {
        for (let u of src) {
            if (!u.isBot) {
                continue;
            }

            let count = await client.count(ctx, 'bots', 'uid = ' + u.id);
            if (count === 0) {
                await client.insert(ctx, 'bots', ['uid'], [[u.id]]);
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
    updateReader('clickhouse-org-users', 2, Store.OrganizationMember.created.stream({ batchSize: 100 }), async (values, first, ctx) => {
        await orgUsers.insert(ctx, client, values.filter(a => a.status === 'joined').map(a => ({
            uid: a.uid,
            oid: a.oid,
            deleted: false,
            sign: 1,
        })));
    });
}

const roomParticipants = table('room_participants', schema({
    uid: integer(),
    cid: integer(),
    deleted: boolean(),
    sign: integer('Int8'),
}), {
    engine: 'CollapsingMergeTree(sign)',
    orderBy: '(cid, uid)',
    partition: 'cid',
    primaryKey: '(cid, uid)'
});
function startRoomParticipantsExport(client: DatabaseClient) {
    updateReader('clickhouse-org-room-participants', 1, Store.RoomParticipant.created.stream({ batchSize: 100 }), async (values, first, ctx) => {
        await roomParticipants.insert(ctx, client, values.filter(a => a.status === 'joined').map(a => ({
            uid: a.uid,
            cid: a.cid,
            deleted: false,
            sign: 1,
        })));
    });
}

const rooms = table('room', schema({
    id: integer(),
    kind: string(), // PUBLIC, PRIVATE
    oid: nullable(integer()),
    deleted: boolean(),
    sign: integer('Int8'),
}), {
    engine: 'CollapsingMergeTree(sign)',
    orderBy: 'id',
    partition: 'id',
    primaryKey: 'id'
});
function startRoomExport(client: DatabaseClient) {
    updateReader('clickhouse-rooms', 1, Store.RoomProfile.created.stream({ batchSize: 100 }), async (values, first, parent) => {
        let res = [];
        for (let a of values) {
            let convRoom = await inReadOnlyTx(parent, async ctx => Store.ConversationRoom.findById(ctx, a.id));
            if (!convRoom) {
                continue;
            }
            res.push({
                id: convRoom.id,
                kind: convRoom.kind,
                oid: convRoom.oid,
                deleted: convRoom.isDeleted || false,
                sign: 1,
            });
        }
        await rooms.insert(parent, client, res);
    });
}

const presencesModern = table('presences_modern', schema({
    date: date(),
    uid: integer(),
    platform: integer('UInt8') // 0 - undefined, 1 - web, 2 - ios, 3 - android, 4 - desktop
}), { partition: 'toYYYYMM(date)', orderBy: '(date, uid)', primaryKey: '(date, uid)' });
function startModernPresenceExport(client: DatabaseClient) {
    subspaceReader<Buffer>('presence_log_reader', 3, 1000, Store.PresenceLogDirectory.withKeyEncoding(encoders.tuple), async (values, first, ctx) => {
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
        startHyperlogExport(client);
        startOrgUsersExport(client);
        startRoomParticipantsExport(client);
        startModernPresenceExport(client);
        startRoomExport(client);
    })();
}