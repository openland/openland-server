import { EntityFactory } from '@openland/foundationdb-entity';
import { createNamedContext } from '@openland/context';
import { inTx } from '@openland/foundationdb';

const ctx = createNamedContext('entities-count');
const BATCH_SIZE = 1024;

export async function findEntitiesCount(entity: EntityFactory<any, any>) {
    let after: undefined|any[] = undefined;
    let res = 0;

    while (true) {
        let data: { key: any, value: any; }[] = await inTx(ctx, async () =>
            await entity.descriptor.subspace.snapshotRange(ctx, [], { limit: BATCH_SIZE, after })
        );
        if (data.length === 0) {
           return res;
        }

        res += data.length;
        after = data[data.length - 1].key;
    }
}
