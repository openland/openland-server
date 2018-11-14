// tslint:disable:no-floating-promises
import * as fdb from 'foundationdb';
// import { FConnection } from 'foundation-orm/FConnection';
import { RandomIDFactory } from '../openland-security/RandomIDFactory';
// import { FKeyEncoding } from 'foundation-orm/utils/FKeyEncoding';

fdb.setAPIVersion(510);
(async () => {
    let db1 = fdb.openSync()
        // .wi(fdb.encoders.json)
        .at(fdb.encoders.tuple.pack(['_benchmarking_1']));
    await db1.clearRange(fdb.encoders.tuple.pack([]));
    let db = db1.withKeyEncoding(fdb.encoders.tuple)
        .withValueEncoding(fdb.encoders.json);
    let random1 = new RandomIDFactory(1);
    let random2 = random1; // new RandomIDFactory(0);
    let start = Date.now();
    let promises = [];
    let count = 0;
    let retry = 0;
    let txTime = 0;
    let rawtxtime = 0;
    for (let i = 0; i < 1000; i++) {
        promises.push((async () => {
            let txstart = Date.now();
            await db.doTn(async (v) => {
                let txopstart = Date.now();
                count++;
                let random = i % 2 === 1 ? random1 : random2;
                let id = random.next();
                while (true) {
                    let existing = await (await v.getRange([id], ['ff'.repeat(id.length / 2)], { limit: 1 })).next();
                    if (existing.done) {
                        break;
                    }
                    retry++;
                    id = random.next();
                }
                // await v.get([id]);
                v.set([id], 1);
                // await v.get([id]);
                // let res = await v.get([id]);
                // if (res) {
                //     v.set([id], res + 1);
                // } else {
                //     v.set([id], 1);
                // }

                // let res2 = await v.get(['counter2!' + i]);
                // if (res2) {
                //     v.set(['counter2!' + (i)], res2 + 1);
                // } else {
                //     v.set(['counter2!' + (i)], 1);
                // }
                rawtxtime += Date.now() - txopstart;
            }, { causal_read_risky: true });
            txTime += Date.now() - txstart;
        })());
    }
    for (let p of promises) {
        await p;
    }
    let delta = (Date.now() - start);
    console.log('Incremented in ' + delta + ' ms (' + count + '), speed: ' + (count / (delta / 1000)) + ' ops/sec');
    console.log('retry: ' + retry);
    console.log('tx retry probability: ' + retry / 500000);
    console.log('txtime: ' + (txTime / count) + ' ms');
    console.log('rawtxtime: ' + (rawtxtime / count) + ' ms');
})();