import { FEntity } from '../FEntity';
import { Context, createEmptyContext } from '../../openland-utils/Context';
import { FEntityFactory } from '../FEntityFactory';
import { inTx } from '../inTx';
import { FDB } from '../../openland-module-db/FDB';
import { resolveContext } from './contexts';

export async function checkIndexConsistency<T extends FEntity>(parent: Context, entity: FEntityFactory<T>, indexKey: (string | number)[], extractRawId: (value: any) => (string | number)[]) {
    // Find index inconsistency
    let duplicatesCount = 0;
    await inTx(parent, async (ctx) => {
        let data = await entity.namespace.range(ctx, FDB.connection, indexKey);

        for (let item of data) {
            let rawId = extractRawId(item.item);
            let actual = await entity.namespace.get(ctx, FDB.connection, rawId);

            if (JSON.stringify(actual) !== JSON.stringify(item.item)) {
                duplicatesCount++;
            }
        }
    });

    return duplicatesCount;
}

export async function fixIndexConsistency<T extends FEntity>(parent: Context, entity: FEntityFactory<T>, indexKey: (string | number)[], extractRawId: (value: any) => (string | number)[], getData: (ctx: Context) => Promise<T[]>) {
    // Remove duplicates from index
    let duplicatesCount = 0;
    await inTx(parent, async (ctx) => {
        let data = await entity.namespace.range(ctx, FDB.connection, indexKey);

        for (let item of data) {
            let rawId = extractRawId(item.item);
            let actual = await entity.namespace.get(ctx, FDB.connection, rawId);

            if (JSON.stringify(actual) !== JSON.stringify(item.item)) {
                duplicatesCount++;
                await resolveContext(ctx).delete(ctx, FDB.connection, item.key);
            }
        }
    });

    // Reindex all
    await inTx(createEmptyContext(), async (ctx) => {
        let data = await getData(ctx);
        for (let item of data) {
            await item.flush();
        }
    });

    return duplicatesCount;
}