import { MigrationDefinition } from '@openland/foundationdb-migrations/lib/MigrationDefinition';
import { Store } from 'openland-module-db/FDB';
import { inTx } from '@openland/foundationdb';

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

export default migrations;