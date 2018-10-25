import { keySelector } from 'foundationdb';
import { staticWorker } from 'openland-module-workers/staticWorker';
import { performMigrations, FMigration } from 'foundation-orm/FMigrator';
import { FDB } from './FDB';
import { inTx } from 'foundation-orm/inTx';

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
    (async () => {
        let fdb = FDB.connection.fdb;
        console.log((await fdb.getRangeAll(['entity', 'userProfile', '__indexes', 'byUpdatedAt'], undefined)).length);
        let start: any = keySelector.firstGreaterOrEqual(['entity', 'userProfile', '__indexes', 'byUpdatedAt']);
        let end = ['entity', 'userProfile', '__indexes', 'byUpdatedAu'];
        console.log('ex', start);
        console.log('ex2', end);
        // console.log(encoders.tuple.pack([0xff]));

        // let end: any = [20000000, 20000000];
        // keySelector.firstGreaterThan(['entity', 'userProfile', '__indexes', 'byUpdatedAt']);
        // let end = keySelector.lastLessThan(['entity', 'userProfile', '__indexes', 'byUpdatedAt']);
        for (let i = 0; i < 10; i++) {
            await fdb.doTransaction(async (tn) => {
                let res = await tn.getRangeAll(start, end, { limit: 10 });
                console.log('res: ' + res.length);
                console.log(res.map((v) => v[0]));
                start = keySelector.firstGreaterOrEqual(res[res.length - 2][0] as any);
                // while (true) {
                //     const item = await res.next();
                //     if (item.done) { break; }
                //     console.log(item);
                //     start = item.value[0];
                // }
            });

            // console.log(res.map((v) => v[0]));
            // start = keySelector.firstGreaterThan(res[res.length - 1][0]); // keySelector.firstGreaterThan(res[res.length - 1][0] as any);
            console.log(start);

            // break;
            // if (res.length === 0) {
            //     break;
            // }
        }
    })();
}