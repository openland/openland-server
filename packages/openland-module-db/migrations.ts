import { staticWorker } from 'openland-module-workers/staticWorker';
import { performMigrations, FMigration } from 'foundation-orm/FMigrator';
import { FDB } from './FDB';
import { inTx } from 'foundation-orm/inTx';
import { FDoctor } from 'foundation-orm/FDoctor';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { DB } from 'openland-server/tables';
import { Modules } from 'openland-modules/Modules';
// import { FEntity } from 'foundation-orm/FEntity';
import { createLogger } from 'openland-log/createLogger';
// import { FEntity } from 'foundation-orm/FEntity';
// import { FStreamItem } from 'foundation-orm/FStreamItem';
// import { UserProfile } from './schema';
// import { FKeyEncoding } from 'foundation-orm/utils/FKeyEncoding';

const logger = createLogger('migration');

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

// migrations.push({
//     key: '14-fix-ids',
//     migration: async () => {
//         for (let e of FDB.allEntities) {
//             logger.log('Starting migration of ' + e.name);
//             let all = await e.namespace.range(FDB.connection, []);
//             all = all.filter((v) => !v.key.find((k) => k === '__indexes')).map((v) => ({ item: v.item, key: v.key.slice(2) }));
//             // let all = await e.findAll();
//             logger.log('Loaded ' + all.length);
//             let pending: { item: any, key: any[] }[] = [];
//             for (let a of all) {
//                 pending.push(a);
//                 if (pending.length > 500) {
//                     await inTx(async () => {
//                         for (let p of pending) {
//                             let res = await e.namespace.get(e.connection, p.key);
//                             let entity = e.doCreateEntity({ ...e.extractId(p.key), ...res }, false);
//                             entity.markDirty();
//                         }
//                     });
//                     pending = [];
//                 }
//             }
//             if (pending.length > 0) {
//                 await inTx(async () => {
//                     for (let p of pending) {
//                         let res = await e.namespace.get(e.connection, p.key);
//                         try {
//                             let entity = e.doCreateEntity({ ...e.extractId(p.key), ...res }, false);
//                             entity.markDirty();
//                         } catch (e) {
//                             console.warn(p.key);
//                             console.warn(e);
//                             throw e;
//                         }
//                     }
//                 });
//             }
//         }
//     }
// });

migrations.push({
    key: '10-move-entities-to-directory',
    migration: async () => {
        for (let e of FDB.allEntities) {
            logger.log('Starting migration of ' + e.name);
            let after: any[] | undefined;
            while (true) {
                let all = after ? await e.findAllKeysAfter(after, 500) : await e.findAllKeys(500);
                if (all.length === 0) {
                    break;
                }
                logger.log('Loaded ' + all.length);
                logger.log(after);
                await inTx(async () => {
                    for (let p of all) {
                        try {
                            let a2 = (await e.findByRawId(p.slice(2)))!;
                            a2.markDirty();
                        } catch (e) {
                            logger.debug(e);
                            logger.debug(p);
                            throw e;
                        }
                    }
                });
                after = all[all.length - 1];
            }
        }
    }
});

migrations.push({
    key: '11-move-entities-to-directory',
    migration: async () => {
        let users = (await DB.User.findAll());
        for (let u of users) {
            await Modules.Messaging.fixer.fixForUser(u.id!);
        }
    }
});

migrations.push({
    key: '12-fix-counters',
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