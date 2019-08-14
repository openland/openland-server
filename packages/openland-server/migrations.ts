import { MigrationDefinition } from '@openland/foundationdb-migrations/lib/MigrationDefinition';
import { Store } from 'openland-module-db/FDB';
import { inTx, encoders } from '@openland/foundationdb';

let migrations: MigrationDefinition[] = [];

migrations.push({
    key: '100-remove-invalid-presences',
    migration: async (parent) => {
        let subspaces = [
            Store.Presence.descriptor.subspace,
            ...Store.Presence.descriptor.secondaryIndexes.map((v) => v.subspace)
        ];
        for (let s of subspaces) {
            await inTx(parent, async (ctx) => {
                let all = await s.range(ctx, []);
                for (let a of all) {
                    if (typeof a.value.tid === 'number') {
                        s.clear(ctx, a.key);
                    }
                }
            });
        }
    }
});

migrations.push({
    key: '101-remove-invalid-web-push-tokenss',
    migration: async (parent) => {
        let subspaces = [
            Store.PushWeb.descriptor.subspace,
            ...Store.PushWeb.descriptor.secondaryIndexes.map((v) => v.subspace)
        ];
        for (let s of subspaces) {
            await inTx(parent, async (ctx) => {
                let all = await s.range(ctx, []);
                for (let a of all) {
                    if (typeof a.value.tid === 'number') {
                        s.clear(ctx, a.key);
                    }
                }
            });
        }
    }
});

migrations.push({
    key: '102-remove-invalid-apple-push-tokenss',
    migration: async (parent) => {
        let subspaces = [
            Store.PushApple.descriptor.subspace,
            ...Store.PushApple.descriptor.secondaryIndexes.map((v) => v.subspace)
        ];
        for (let s of subspaces) {
            await inTx(parent, async (ctx) => {
                let all = await s.range(ctx, []);
                for (let a of all) {
                    if (typeof a.value.tid === 'number') {
                        s.clear(ctx, a.key);
                    }
                }
            });
        }
    }
});

migrations.push({
    key: '103-remove-invalid-firebase-tokens',
    migration: async (parent) => {
        let subspaces = [
            Store.PushFirebase.descriptor.subspace,
            ...Store.PushFirebase.descriptor.secondaryIndexes.map((v) => v.subspace)
        ];
        for (let s of subspaces) {
            await inTx(parent, async (ctx) => {
                let all = await s.range(ctx, []);
                for (let a of all) {
                    if (typeof a.value.tid === 'number') {
                        s.clear(ctx, a.key);
                    }
                }
            });
        }
    }
});

migrations.push({
    key: '104-remove-invalid-safari-tokens',
    migration: async (parent) => {
        let subspaces = [
            Store.PushSafari.descriptor.subspace,
            ...Store.PushSafari.descriptor.secondaryIndexes.map((v) => v.subspace)
        ];
        for (let s of subspaces) {
            await inTx(parent, async (ctx) => {
                let all = await s.range(ctx, []);
                for (let a of all) {
                    if (typeof a.value.tid === 'number') {
                        s.clear(ctx, a.key);
                    }
                }
            });
        }
    }
});

migrations.push({
    key: '105-migrate-dialog-index',
    migration: async (parent) => {

        await inTx(parent, async (ctx) => {
            let dialogs = (await Store.UserDialog.findAll(ctx));
            let dc = Store.UserDialogIndexDirectory
                .withKeyEncoding(encoders.tuple)
                .withValueEncoding(encoders.json);
            for (let d of dialogs) {
                if (d.date) {
                    dc.set(ctx, [d.uid, d.cid], { date: d.date! });
                } else {
                    dc.clear(ctx, [d.uid, d.cid]);
                }
            }
        });
    }
});

migrations.push({
    key: '106-migrate-dialog-read-message-id',
    migration: async (parent) => {
        await inTx(parent, async (ctx) => {
            let dialogs = (await Store.UserDialog.findAll(ctx));

            for (let d of dialogs) {
                if (d.readMessageId) {
                    Store.UserDialogReadMessageId.set(ctx, d.uid, d.cid, d.readMessageId);
                }
            }
        });
    }
});

export default migrations;