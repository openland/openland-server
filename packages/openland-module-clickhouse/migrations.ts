import { Context } from '@openland/context';
import DatabaseClient from './DatabaseClient';
import { Migration } from './Migration';

const migrations: Migration[] = [];
export { migrations };

migrations.push({
    name: '01-db-create',
    command: async (ctx: Context, client: DatabaseClient) => {
        await client.createDatabase(ctx);
    }
});
migrations.push({
    name: '02-presence-create',
    command: async (ctx: Context, client: DatabaseClient) => {
        await client.createTable(ctx, 'presences', [{
            name: 'time',
            type: 'DateTime'
        }, {
            name: 'eid',
            type: 'String'
        }, {
            name: 'uid',
            type: 'Int64'
        }, {
            name: 'platform',
            type: 'String'
        }],
            'toYYYYMM(time)',
            '(eid, time)',
            'eid');
    }
});
migrations.push({
    name: '02-messages-create',
    command: async (ctx: Context, client: DatabaseClient) => {
        await client.createTable(ctx, 'messages', [{
            name: 'time',
            type: 'DateTime'
        }, {
            name: 'id',
            type: 'String'
        }, {
            name: 'uid',
            type: 'Int64'
        }, {
            name: 'type',
            type: 'String'
        }, {
            name: 'service',
            type: 'UInt8'
        }],
            'toYYYYMM(time)',
            '(id, time)',
            'id');
    }
});

migrations.push({
    name: '03-admins',
    command: async (ctx: Context, client: DatabaseClient) => {
        await client.createTable(ctx, 'admins', [{
            name: 'uid',
            type: 'Int64'
        }],
            'uid',
            'uid',
            'uid');
    }
});

migrations.push({
    name: '04-bots',
    command: async (ctx: Context, client: DatabaseClient) => {
        await client.createTable(ctx, 'bots', [{
            name: 'uid',
            type: 'Int64'
        }],
            'uid',
            'uid',
            'uid');
    }
});

migrations.push({
    name: '04-signups',
    command: async (ctx: Context, client: DatabaseClient) => {
        await client.createTable(ctx, 'signups', [{
            name: 'time',
            type: 'DateTime'
        }, {
            name: 'uid',
            type: 'Int64'
        }],
            'toYYYYMM(time)',
            '(uid, time)',
            'uid');
    }
});

migrations.push({
    name: '05-user_activated',
    command: async (ctx: Context, client: DatabaseClient) => {
        await client.createTable(ctx, 'user_activated', [{
            name: 'time',
            type: 'DateTime',
        }, {
            name: 'uid',
            type: 'Int64',
        }],
            'toYYYYMM(time)',
            '(uid, time)',
            'uid');
    }
});

migrations.push({
    name: '06-new-mobile-user',
    command: async (ctx: Context, client: DatabaseClient) => {
        await client.createTable(ctx, 'new_mobile_user', [{
                name: 'time',
                type: 'DateTime',
            }, {
                name: 'uid',
                type: 'Int64',
            }],
            'toYYYYMM(time)',
            '(uid, time)',
            'uid');
    }
});

migrations.push({
    name: '07-new_sender',
    command: async (ctx: Context, client: DatabaseClient) => {
        await client.createTable(ctx, 'new_sender', [{
                name: 'time',
                type: 'DateTime',
            }, {
                name: 'uid',
                type: 'Int64',
            }],
            'toYYYYMM(time)',
            '(uid, time)',
            'uid');
    }
});

migrations.push({
    name: '08-new_inviter',
    command: async (ctx: Context, client: DatabaseClient) => {
        await client.createTable(ctx, 'new_inviter', [{
                name: 'time',
                type: 'DateTime',
            }, {
                name: 'uid',
                type: 'Int64',
            }, {
                name: 'invitee_id',
                type: 'Int64',
            }],
            'toYYYYMM(time)',
            '(uid, time)',
            'uid');
    }
});

migrations.push({
    name: '09-new-about-filler',
    command: async (ctx: Context, client: DatabaseClient) => {
        await client.createTable(ctx, 'new_about_filler', [{
                name: 'time',
                type: 'DateTime',
            }, {
                name: 'uid',
                type: 'Int64',
            }],
            'toYYYYMM(time)',
            '(uid, time)',
            'uid');
    }
});

migrations.push({
    name: '10-new-three-like-getter',
    command: async (ctx: Context, client: DatabaseClient) => {
        await client.createTable(ctx, 'new_three_like_getter', [{
                name: 'time',
                type: 'DateTime',
            }, {
                name: 'uid',
                type: 'Int64',
            }],
            'toYYYYMM(time)',
            '(uid, time)',
            'uid');
    }
});

migrations.push({
    name: '11-new-three-like-giver',
    command: async (ctx: Context, client: DatabaseClient) => {
        await client.createTable(ctx, 'new_three_like_giver', [{
                name: 'time',
                type: 'DateTime',
            }, {
                name: 'uid',
                type: 'Int64',
            }],
            'toYYYYMM(time)',
            '(uid, time)',
            'uid');
    }
});

migrations.push({
    name: '12-new-reaction',
    command: async (ctx: Context, client: DatabaseClient) => {
        await client.createTable(ctx, 'reaction', [{
                name: 'time',
                type: 'DateTime',
            }, {
                name: 'id',
                type: 'String',
            }, {
                name: 'uid',
                type: 'Int64',
            }, {
                name: 'mid',
                type: 'Int64',
            }, {
                name: 'message_author_id',
                type: 'Int64',
            }],
            'toYYYYMM(time)',
            '(id, uid, time)',
            'id');
    }
});

migrations.push({
    name: '13-call-ended',
    command: async (ctx: Context, client: DatabaseClient) => {
        await client.createTable(ctx, 'call_ended', [{
            name: 'time',
            type: 'DateTime',
        }, {
            name: 'duration',
            type: 'Int64'
        }, {
            name: 'id',
            type: 'String'
        }], 'toYYYYMM(time)',
            '(id, time)',
            'id');
    }
});

migrations.push({
    name: '14-platform-to-modern-presences',
    command: async (ctx: Context, client: DatabaseClient)  => {
        await client.query(ctx, `ALTER TABLE ${client.dbName}.presences_modern ADD COLUMN platform UInt8`);
    }
});

migrations.push({
    name: '14-clear-modern-presences',
    command: async (ctx: Context, client: DatabaseClient)  => {
        await client.query(ctx, `DROP TABLE ${client.dbName}.presences_modern`);
    }
});

migrations.push({
    name: '15-clear-modern-presences',
    command: async (ctx: Context, client: DatabaseClient)  => {
        await client.query(ctx, `DROP TABLE ${client.dbName}.presences_modern`);
    }
});

migrations.push({
    name: '16-clear-org-users',
    command: async (ctx: Context, client: DatabaseClient)  => {
        await client.query(ctx, `DROP TABLE ${client.dbName}.org_users`);
    }
});

migrations.push({
    name: '17-clear-org-users',
    command: async (ctx: Context, client: DatabaseClient)  => {
        await client.query(ctx, `DROP TABLE ${client.dbName}.org_users`);
    }
});

//
// ╔╗║║╦╔╗╔═╗╔═║║╔═╔╗╔╗╦╔═╦╗
// ╠╣║║║║║║╔╗╠═╬║╠═╠╝╠╣║╠═║║
// ║║╚╝║╚╝╚═╝╚═║╬╚═╠╗║║║╚═╩╝
//
migrations.push({
    name: 'AUTOGENERATED-task_completed-create',
    command: async (ctx: Context, db: DatabaseClient) => {
        await db.createTable(
                ctx, 
                'task_completed', 
                 // tslint:disable-next-line
                [{"name":"taskId","type":"String"},{"name":"taskType","type":"String"},{"name":"duration","type":"Int64"},{"name":"id","type":"String"},{"name":"date","type":"DateTime"}], 
                'toYYYYMM(date)', 
                '(id, date)', 
                'id', 
                'MergeTree()'
            );
    }
});

//
// ╔╗║║╦╔╗╔═╗╔═║║╔═╔╗╔╗╦╔═╦╗
// ╠╣║║║║║║╔╗╠═╬║╠═╠╝╠╣║╠═║║
// ║║╚╝║╚╝╚═╝╚═║╬╚═╠╗║║║╚═╩╝
//
migrations.push({
    name: 'AUTOGENERATED-task_scheduled-create',
    command: async (ctx: Context, db: DatabaseClient) => {
        await db.createTable(
                ctx, 
                'task_scheduled', 
                 // tslint:disable-next-line
                [{"name":"taskId","type":"String"},{"name":"taskType","type":"String"},{"name":"duration","type":"Int64"},{"name":"id","type":"String"},{"name":"date","type":"DateTime"}], 
                'toYYYYMM(date)', 
                '(id, date)', 
                'id', 
                'MergeTree()'
            );
    }
});

//
// ╔╗║║╦╔╗╔═╗╔═║║╔═╔╗╔╗╦╔═╦╗
// ╠╣║║║║║║╔╗╠═╬║╠═╠╝╠╣║╠═║║
// ║║╚╝║╚╝╚═╝╚═║╬╚═╠╗║║║╚═╩╝
//
migrations.push({
    name: 'AUTOGENERATED-wallet_payment_event-create',
    command: async (ctx: Context, db: DatabaseClient) => {
        await db.createTable(
                ctx, 
                'wallet_payment_event', 
                 // tslint:disable-next-line
                [{"name":"type","type":"String"},{"name":"uid","type":"Int64"},{"name":"amount","type":"Int64"},{"name":"pid","type":"String"},{"name":"operation.type","type":"String"},{"name":"operation.deposit.uid","type":"Nullable(Int64)"},{"name":"operation.deposit.txid","type":"Nullable(String)"},{"name":"operation.subscription.uid","type":"Nullable(Int64)"},{"name":"operation.subscription.subscription","type":"Nullable(String)"},{"name":"operation.subscription.period","type":"Nullable(Int64)"},{"name":"operation.subscription.txid","type":"Nullable(String)"},{"name":"operation.transfer.fromUid","type":"Nullable(Int64)"},{"name":"operation.transfer.fromTx","type":"Nullable(String)"},{"name":"operation.transfer.toUid","type":"Nullable(Int64)"},{"name":"operation.transfer.toTx","type":"Nullable(String)"},{"name":"operation.purchase.id","type":"Nullable(String)"},{"name":"id","type":"String"},{"name":"date","type":"DateTime"}], 
                'toYYYYMM(date)', 
                '(id, date)', 
                'id', 
                'MergeTree()'
            );
    }
});

//
// ╔╗║║╦╔╗╔═╗╔═║║╔═╔╗╔╗╦╔═╦╗
// ╠╣║║║║║║╔╗╠═╬║╠═╠╝╠╣║╠═║║
// ║║╚╝║╚╝╚═╝╚═║╬╚═╠╗║║║╚═╩╝
//
migrations.push({
    name: 'AUTOGENERATED-wallet_purchase_event-create',
    command: async (ctx: Context, db: DatabaseClient) => {
        await db.createTable(
                ctx, 
                'wallet_purchase_event', 
                 // tslint:disable-next-line
                [{"name":"type","type":"String"},{"name":"pid","type":"String"},{"name":"uid","type":"Int64"},{"name":"amount","type":"Int64"},{"name":"product.type","type":"String"},{"name":"product.group.gid","type":"Nullable(Int64)"},{"name":"product.donate_message.uid","type":"Nullable(Int64)"},{"name":"product.donate_message.cid","type":"Nullable(Int64)"},{"name":"product.donate_message.mid","type":"Nullable(Int64)"},{"name":"product.donate_reaction.uid","type":"Nullable(Int64)"},{"name":"product.donate_reaction.mid","type":"Nullable(Int64)"},{"name":"id","type":"String"},{"name":"date","type":"DateTime"}], 
                'toYYYYMM(date)', 
                '(id, date)', 
                'id', 
                'MergeTree()'
            );
    }
});

//
// ╔╗║║╦╔╗╔═╗╔═║║╔═╔╗╔╗╦╔═╦╗
// ╠╣║║║║║║╔╗╠═╬║╠═╠╝╠╣║╠═║║
// ║║╚╝║╚╝╚═╝╚═║╬╚═╠╗║║║╚═╩╝
//
migrations.push({
    name: 'AUTOGENERATED-wallet_subscription_event-create',
    command: async (ctx: Context, db: DatabaseClient) => {
        await db.createTable(
                ctx, 
                'wallet_subscription_event', 
                 // tslint:disable-next-line
                [{"name":"type","type":"String"},{"name":"sid","type":"String"},{"name":"uid","type":"Int64"},{"name":"amount","type":"Int64"},{"name":"interval","type":"String"},{"name":"start","type":"Int64"},{"name":"state","type":"String"},{"name":"product.type","type":"String"},{"name":"product.donate.uid","type":"Nullable(Int64)"},{"name":"product.group.gid","type":"Nullable(Int64)"},{"name":"id","type":"String"},{"name":"date","type":"DateTime"}], 
                'toYYYYMM(date)', 
                '(id, date)', 
                'id', 
                'MergeTree()'
            );
    }
});

//
// ╔╗║║╦╔╗╔═╗╔═║║╔═╔╗╔╗╦╔═╦╗
// ╠╣║║║║║║╔╗╠═╬║╠═╠╝╠╣║╠═║║
// ║║╚╝║╚╝╚═╝╚═║╬╚═╠╗║║║╚═╩╝
//
migrations.push({
    name: 'AUTOGENERATED-wallet_payment_intent_event-create',
    command: async (ctx: Context, db: DatabaseClient) => {
        await db.createTable(
                ctx, 
                'wallet_payment_intent_event', 
                 // tslint:disable-next-line
                [{"name":"type","type":"String"},{"name":"amount","type":"Int64"},{"name":"operation.type","type":"String"},{"name":"operation.deposit.uid","type":"Nullable(Int64)"},{"name":"operation.payment.id","type":"Nullable(String)"},{"name":"operation.purchase.id","type":"Nullable(String)"},{"name":"id","type":"String"},{"name":"date","type":"DateTime"}], 
                'toYYYYMM(date)', 
                '(id, date)', 
                'id', 
                'MergeTree()'
            );
    }
});

//
// ╔╗║║╦╔╗╔═╗╔═║║╔═╔╗╔╗╦╔═╦╗
// ╠╣║║║║║║╔╗╠═╬║╠═╠╝╠╣║╠═║║
// ║║╚╝║╚╝╚═╝╚═║╬╚═╠╗║║║╚═╩╝
//
migrations.push({
    name: 'AUTOGENERATED-sms_sent-create',
    command: async (ctx: Context, db: DatabaseClient) => {
        await db.createTable(
                ctx, 
                'sms_sent', 
                 // tslint:disable-next-line
                [{"name":"phone","type":"String"},{"name":"id","type":"String"},{"name":"date","type":"DateTime"}], 
                'toYYYYMM(date)', 
                '(id, date)', 
                'id', 
                'MergeTree()'
            );
    }
});

//
// ╔╗║║╦╔╗╔═╗╔═║║╔═╔╗╔╗╦╔═╦╗
// ╠╣║║║║║║╔╗╠═╬║╠═╠╝╠╣║╠═║║
// ║║╚╝║╚╝╚═╝╚═║╬╚═╠╗║║║╚═╩╝
//
migrations.push({
    name: 'AUTOGENERATED-org_users-create',
    command: async (ctx: Context, db: DatabaseClient) => {
        await db.createTable(
                ctx, 
                'org_users', 
                 // tslint:disable-next-line
                [{"name":"uid","type":"Int64"},{"name":"oid","type":"Int64"},{"name":"deleted","type":"UInt8"},{"name":"sign","type":"Int8"}], 
                'oid', 
                '(oid, uid)', 
                '(oid, uid)', 
                'CollapsingMergeTree(sign)'
            );
    }
});

//
// ╔╗║║╦╔╗╔═╗╔═║║╔═╔╗╔╗╦╔═╦╗
// ╠╣║║║║║║╔╗╠═╬║╠═╠╝╠╣║╠═║║
// ║║╚╝║╚╝╚═╝╚═║╬╚═╠╗║║║╚═╩╝
//
migrations.push({
    name: 'AUTOGENERATED-presences_modern-create',
    command: async (ctx: Context, db: DatabaseClient) => {
        await db.createTable(
                ctx, 
                'presences_modern', 
                 // tslint:disable-next-line
                [{"name":"date","type":"DateTime"},{"name":"uid","type":"Int64"},{"name":"platform","type":"UInt8"}], 
                'toYYYYMM(date)', 
                '(date, uid)', 
                '(date, uid)', 
                'MergeTree()'
            );
    }
});
