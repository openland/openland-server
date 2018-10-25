import { staticWorker } from 'openland-module-workers/staticWorker';
import { performMigrations, FMigration } from 'foundation-orm/FMigrator';
import { FDB } from './FDB';
import { inTx } from 'foundation-orm/inTx';
// import { FStreamItem } from 'foundation-orm/FStreamItem';
// import { UserProfile } from './schema';
// import { FKeyEncoding } from 'foundation-orm/utils/FKeyEncoding';

var migrations: FMigration[] = [];
migrations.push({
    key: '2-addStreamingIndex',
    migration: async () => {
        await inTx(async () => {
            let ex = await FDB.UserProfile.findAll();
            for (let e of ex) {
                e.markDirty();
            }
        });
    }
});

export function startMigrationsWorker() {
    staticWorker({ name: 'foundation-migrator' }, async () => {
        await performMigrations(FDB.connection, migrations);
        return false;
    });
    // (async () => {
    //     console.log((await FDB.connection.fdb.getRangeAll(FKeyEncoding.encodeKey(['entity', 'userProfile', '__indexes', 'byUpdatedAt']), undefined)).length);
    //     let cursor: string | undefined = undefined;
    //     while (true) {
    //         let batch: FStreamItem<UserProfile>[] = (await FDB.UserProfile.afterFromByUpdatedAt(3, cursor));
    //         if (batch.length === 0) {
    //             console.log('end');
    //             break;
    //         }
    //         console.log('next');
    //         for (let b of batch) {
    //             console.log(b.value.updatedAt + '-' + b.value.id);
    //             cursor = b.cursor;
    //         }
    //     }
    // })();
}