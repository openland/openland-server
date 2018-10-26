import { FEntityFactory } from './FEntityFactory';
import { inTx } from './inTx';
import { FEntity } from './FEntity';
// import { createLogger } from 'openland-log/createLogger';
import { FConnection } from './FConnection';
import { FKeyEncoding } from './utils/FKeyEncoding';

// const log = createLogger('doctor');

export const FDoctor = {

    async dropEntities(connection: FConnection, name: string) {
        await connection.fdb.doTransaction(async (tn) => {
            tn.clearRangeStartsWith(FKeyEncoding.encodeKey(['entity', name]));
        });
    },

    async customDoctor<T extends FEntity>(entity: FEntityFactory<T>, handle: (value: any) => any | null) {
        await inTx(async () => {
            let all = await entity.findAllWithIds();
            for (let i of all) {
                let fixed = handle(i.item);
                if (fixed) {
                    (i.item as any)._value = { ...fixed, ...(i.item as any)._value };
                    (i.item as any)._valueInitial = { ...fixed, ...(i.item as any)._valueInitial };
                    (i.item as any).markDirty();
                }
            }
        });
    },

    async doctorEntityIds(entity: FEntityFactory<any>) {
        // await inTx(async () => {
        //     log.log('Trying to fix entity ids');
        //     let all = await entity.findAllWithIds();
        //     log.log('Found ' + all.length + ' entities');
        //     for (let i of all) {
        //         let id = entity.extractId(i.key);
        //         (i.item as any).rawId = i.key;
        //         (i.item as any)._value = { ...(i.item as any)._value, ...id, };
        //         (i.item as any)._valueInitial = { ...(i.item as any)._valueInitial, ...id };
        //         (i.item as any).markDirty();
        //         log.log('Updated entity ' + (i.item as any)._value);
        //     }
        // });
    }
};