// Register Modules
require('module-alias/register');

// tslint:disable:no-floating-promises
import Benchmark from 'benchmark';
// @ts-ignore
import * as fdb from 'foundationdb';
// @ts-ignore
import { RandomIDFactory } from '../openland-security/RandomIDFactory';
// @ts-ignore
import { delay } from '../openland-utils/timer';
import { AllEntitiesDirect } from 'foundation-orm/tests/testSchema';
import { FConnection } from 'foundation-orm/FConnection';
import { NoOpBus } from 'foundation-orm/tests/NoOpBus';
import { inTx } from 'foundation-orm/inTx';
import { createNamedContext } from '@openland/context';
import { createLogger } from '@openland/log';

let rootCtx = createNamedContext('benchmark');
let logger = createLogger('benchmark');

fdb.setAPIVersion(510);
let db1 = fdb.openSync()
    .at(fdb.encoders.tuple.pack(['_benchmarking_2']));
// @ts-ignore
let db = db1.withKeyEncoding(fdb.encoders.tuple)
    .withValueEncoding(fdb.encoders.json);

let suite = new Benchmark.Suite('FDB');

function addAsync(name: string, fn: () => Promise<void>) {
    suite.add(name, {
        defer: true, fn: (d: any) => {
            (async () => {
                try {
                    await fn();
                } finally {
                    d.resolve();
                }
            })();
        }
    });
}

// addAsync('random-id-factory', async () => {
//     let random1 = new RandomIDFactory(1);
//     for (let i = 0; i < 100; i++) {
//         random1.next();
//     }
// });
addAsync('tx-1', async () => {
    for (let i = 0; i < 1; i++) {
        await db1.doTn(async (tx) => {
            await tx.get('key1-' + i);
            tx.set('key1-' + i, 'key2');
        });
    }
});

addAsync('tx-10', async () => {
    let p: any[] = [];
    for (let i = 0; i < 10; i++) {
        let p2 = db1.doTn(async (tx) => {
            await tx.get('key2-' + i);
            tx.set('key2-' + i, 'key2');
        });
        p.push(p2);
    }
    await Promise.all(p);
});

addAsync('tx-100', async () => {
    let p: any[] = [];
    for (let i = 0; i < 100; i++) {
        let p2 = db1.doTn(async (tx) => {
            await tx.get('key3-' + i);
            tx.set('key3-' + i, 'key2');
        });
        p.push(p2);
    }
    await Promise.all(p);
});

addAsync('tx-1000', async () => {
    let p: any[] = [];
    for (let i = 0; i < 1000; i++) {
        let p2 = db1.doTn(async (tx) => {
            await tx.get('key3-' + i);
            tx.set('key3-' + i, 'key2');
        });
        p.push(p2);
    }
    await Promise.all(p);
});

addAsync('tx-1000-routine', async () => {
    let p: any[] = [];
    for (let i = 0; i < 1000; i++) {
        let p2 = db1.doTn(async (tx) => {
            await (async () => {
                await tx.get('key4-' + i);
            })();
            tx.set('key4-' + i, 'key2');
        });
        p.push(p2);
    }
    await Promise.all(p);
});

addAsync('tx-10000', async () => {
    let p: any[] = [];
    for (let i = 0; i < 10000; i++) {
        let p2 = db1.doTn(async (tx) => {
            await tx.get('key5-' + i);
            tx.set('key5-' + i, 'key2');
        });
        p.push(p2);
    }
    await Promise.all(p);
});

addAsync('tx-tuple-10000', async () => {
    let p: any[] = [];
    for (let i = 0; i < 10000; i++) {
        let p2 = db.doTn(async (tx) => {
            await tx.get(['entity_test', 'something', i]);
        });
        p.push(p2);
    }
    await Promise.all(p);
});

addAsync('orm-1000', async () => {
    let entities = new AllEntitiesDirect(new FConnection(db1 as any, NoOpBus, false));
    let p: any[] = [];
    for (let i = 0; i < 1000; i++) {
        let p2 = inTx(rootCtx, async (ctx) => {
            await entities.SimpleEntity.findById(ctx, i);
        });
        p.push(p2);
    }
    await Promise.all(p);
});

addAsync('orm-10000', async function orm10000() {
    let entities = new AllEntitiesDirect(new FConnection(db1 as any, NoOpBus, false));
    let p: any[] = [];
    for (let i = 0; i < 10000; i++) {
        let p2 = inTx(rootCtx, async (ctx) => {
            await entities.SimpleEntity.findById(ctx, i);
        });
        p.push(p2);
    }
    await Promise.all(p);
});

addAsync('orm-10000-empty', async function orm10000Empty() {
    let entities = new AllEntitiesDirect(new FConnection(db1 as any, NoOpBus, false));
    let p: any[] = [];
    for (let i = 0; i < 10000; i++) {
        let p2 = inTx(rootCtx, async (ctx) => {
            await entities.SimpleEntity.findById(ctx, 100000 + i);
        });
        p.push(p2);
    }
    await Promise.all(p);
});

suite.on('cycle', function (event: any) {
    logger.log(rootCtx, String(event.target));
});

(async () => {
    await db1.clearRange(fdb.encoders.tuple.pack([]));
    let entities = new AllEntitiesDirect(new FConnection(db1 as any, NoOpBus, false));
    // let keySize = 4096;
    let p: any[] = [];
    logger.log(rootCtx, 'Prepare');
    for (let i = 0; i < 10000; i++) {
        let p2 = inTx(rootCtx, async (ctx) => {
            await entities.SimpleEntity.create(ctx, i, { data: 'data-0' });
            // await tx.get('key-read-' + i);
        });
        p.push(p2);

        let p3 = db.doTn(async (tn) => {
            tn.set(['entity_test', 'something', i], { hello: 'world' });
        });
        p.push(p3);
    }
    await Promise.all(p);
    logger.log(rootCtx, 'Starting');
    suite.run({ async: false });
})();