import { AllEntitiesDirect } from './../../openland-module-db/schema';
import { BusLayer, NoOpBus } from '@openland/foundationdb-bus';
import { Database } from '@openland/foundationdb';
import { EntityLayer } from '../../foundation-orm/EntityLayer';

export async function openDatabase() {
    let db = await Database.open({
        layers: [
            new BusLayer(new NoOpBus())
        ]
    });
    let storage = new EntityLayer(db, 'app');
    return await AllEntitiesDirect.create(storage);
}