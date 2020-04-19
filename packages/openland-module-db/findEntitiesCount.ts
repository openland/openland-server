import { EntityFactory } from '@openland/foundationdb-entity';
import { createNamedContext } from '@openland/context';
import { encoders, getTransaction, inTx } from '@openland/foundationdb';

const rootCtx = createNamedContext('entities-count');

export async function findEntitiesCount(entity: EntityFactory<any, any>, progressCb: (avg: number) => void) {
    let records = await inTx(rootCtx, async ctx => await entity.descriptor.subspace.snapshotRange(ctx, [], { limit: 1 }));
    if (records.length === 0) {
        return 0;
    }
    let firstKey = records[0].key;
    let min = 0;
    // let max = 10 ** 8;
    let max = 2;
    let lastGood = 0;
    let forward = true;

    while (min <= max) {
        let avg = Math.floor((min + max) / 2);
        progressCb(avg);
        let exists = !!(await getKey(entity, firstKey, avg));
        if (exists) {
            lastGood = avg;
            min = avg + 1;
            if (forward) {
                max *= 2;
            }
        } else {
            max = avg - 1;
            forward = false;
        }
    }

    return lastGood;
}

async function getKey(entity: EntityFactory<any, any>, key: any[], offset: number = 0) {
    let db = entity.descriptor.subspace.db;
    let prefix = entity.descriptor.subspace.prefix;
    let id = encoders.tuple.pack(key);

    return await inTx(rootCtx, async (ctx) => {
        getTransaction(ctx).setOptions({
            read_your_writes_disable: true
        });

        let tx = getTransaction(ctx)!.rawTransaction(db);
        let _key = Buffer.concat([prefix, id]);
        let res = await tx.getKey({ key: _key, offset, _isKeySelector: true, orEqual: true});
        if (res) {
            // System key
            if (res.length === 1 && res[0] === 0xff) {
                return null;
            }
            // Wrong prefix
            if (res.indexOf(prefix) !== 0) {
                return null;
            }
            return res;
        }
        return null;
    });
}
