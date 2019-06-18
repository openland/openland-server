import { FEntity } from '../FEntity';
import { FEntityFactory } from '../FEntityFactory';
import { Context } from '@openland/context';
import { inTx } from '@openland/foundationdb';

export async function checkIndexConsistency<T extends FEntity>(parent: Context, entity: FEntityFactory<T>, indexKey: (string | number)[], extractRawId: (value: any) => (string | number)[]) {
    // Find index inconsistency
    let duplicatesCount = 0;
    // await inTx(parent, async (ctx) => {
    //     let data = await entity.namespace.keySpace.range(ctx, indexKey);

    //     for (let item of data) {
    //         let rawId = extractRawId(item.value);
    //         let actual = await entity.namespace.keySpace.get(ctx, rawId);

    //         if (JSON.stringify(actual) !== JSON.stringify(item.value)) {
    //             duplicatesCount++;
    //         }
    //     }
    // });

    return duplicatesCount;
}

export async function fixIndexConsistency<T extends FEntity>(parent: Context, entity: FEntityFactory<T>, indexKey: (string | number)[], extractRawId: (value: any) => (string | number)[], getData: (ctx: Context) => Promise<T[]>) {
    // Remove duplicates from index
    let duplicatesCount = 0;
    // await inTx(parent, async (ctx) => {
    //     let data = await entity.namespace.keySpace.range(ctx, indexKey);

    //     for (let item of data) {
    //         let rawId = extractRawId(item.value);
    //         let actual = await entity.namespace.keySpace.get(ctx, rawId);

    //         if (JSON.stringify(actual) !== JSON.stringify(item.value)) {
    //             duplicatesCount++;
    //             entity.namespace.keySpace.delete(ctx, item.key);
    //         }
    //     }
    // });

    // Reindex all
    await inTx(parent, async (ctx) => {
        let data = await getData(ctx);
        for (let item of data) {
            await item.flush(ctx);
        }
    });

    return duplicatesCount;
}