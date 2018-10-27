// tslint:disable:no-floating-promises
import * as fdb from 'foundationdb';

fdb.setAPIVersion(510);
(async () => {
    let db = fdb.openSync()
        .withValueEncoding(fdb.encoders.int32BE)
        .withKeyEncoding(fdb.encoders.tuple)
        .at(['_benchmarking_1']);
    await db.clearRange([]);
    let db2 = fdb.openSync()
        .withValueEncoding(fdb.encoders.int32BE)
        .withKeyEncoding(fdb.encoders.tuple)
        .at(['_benchmarking_1']);
    let start = Date.now();
    let promises = [];
    let count = 0;
    let txTime = 0;
    let rawtxtime = 0;
    for (let i = 0; i < 100000; i++) {
        promises.push((async () => {
            let txstart = Date.now();
            await (i % 2 === 0 ? db2 : db).doTn(async (v) => {
                await null;
                let txopstart = Date.now();
                count++;
                let res = await v.get(['counter!' + i]);
                if (res) {
                    v.set(['counter!' + (i)], res + 1);
                } else {
                    v.set(['counter!' + (i)], 1);
                }

                let res2 = await v.get(['counter2!' + i]);
                if (res2) {
                    v.set(['counter2!' + (i)], res2 + 1);
                } else {
                    v.set(['counter2!' + (i)], 1);
                }
                rawtxtime += Date.now() - txopstart;
            });
            txTime += Date.now() - txstart;
        })());
    }
    for (let p of promises) {
        await p;
    }
    let delta = (Date.now() - start);
    console.log('Incremented in ' + delta + ' ms (' + count + '), speed: ' + (count / (delta / 1000)) + ' ops/sec');
    console.log('txtime: ' + (txTime / count) + ' ms');
    console.log('rawtxtime: ' + (rawtxtime / count) + ' ms');
})();