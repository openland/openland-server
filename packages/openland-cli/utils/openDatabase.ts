import { BusLayer, NoOpBus } from '@openland/foundationdb-bus';
import { Database } from '@openland/foundationdb';
import { openStore } from 'openland-module-db/store';
import { EntityStorage } from '@openland/foundationdb-entity';
import { Context } from '@openland/context';

export async function openDatabase(ctx: Context) {
    let db = await Database.open({
        layers: [
            new BusLayer(new NoOpBus())
        ]
    });
    let storage = new EntityStorage(db);
    return await openStore(ctx, storage);
}