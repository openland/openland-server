import { staticWorker } from 'openland-module-workers/staticWorker';
import { performMigrations, FMigration } from 'foundation-orm/FMigrator';
import { FDB } from './FDB';
import { inTx } from 'foundation-orm/inTx';
import { FDoctor } from 'foundation-orm/FDoctor';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { DB } from 'openland-server/tables';
import { Modules } from 'openland-modules/Modules';
// import { FStreamItem } from 'foundation-orm/FStreamItem';
// import { UserProfile } from './schema';
// import { FKeyEncoding } from 'foundation-orm/utils/FKeyEncoding';

var migrations: FMigration[] = [];
migrations.push({
    key: '2-addStreamingIndex',
    migration: async () => {
        await FDoctor.doctorEntityIds(FDB.UserProfile);
        await inTx(async () => {
            let ex = await FDB.UserProfile.findAll();
            for (let e of ex) {
                e.markDirty();
            }
        });
    }
});
migrations.push({
    key: '3-fixBrokenIdsInOnlines',
    migration: async () => {
        await FDoctor.doctorEntityIds(FDB.Online);
    }
});
migrations.push({
    key: '4-fixBrokenIdsInOnlines',
    migration: async () => {
        await FDoctor.doctorEntityIds(FDB.Online);
    }
});
migrations.push({
    key: '4-dropOnlines',
    migration: async () => {
        await FDoctor.dropEntities(FDB.connection, 'online');
    }
});

migrations.push({
    key: '6-fix-counters',
    migration: async () => {
        await Promise.all((await DB.User.findAll()).map((u) => Modules.Messaging.fixer.fixForUser(u.id!)));
    }
});

migrations.push({
    key: '7-fix-counters',
    migration: async () => {
        await Promise.all((await DB.User.findAll()).map((u) => Modules.Messaging.fixer.fixForUser(u.id!)));
    }
});

migrations.push({
    key: '8-fix-counters',
    migration: async () => {
        let users = (await DB.User.findAll());
        for (let u of users) {
            await Modules.Messaging.fixer.fixForUser(u.id!);
        }
    }
});

export function startMigrationsWorker() {
    if (serverRoleEnabled('workers')) {
        staticWorker({ name: 'foundation-migrator' }, async () => {
            await performMigrations(FDB.connection, migrations);
            return false;
        });
    }
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