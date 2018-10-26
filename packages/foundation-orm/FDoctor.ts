import { FEntityFactory } from './FEntityFactory';
import { inTx } from './inTx';

export const FDoctor = {
    async doctorEntityIds(entity: FEntityFactory<any>) {
        await inTx(async () => {
            let all = await entity.findAllWithIds();
            for (let i of all) {
                let id = entity.extractId(i.key);
                (i.item as any)._value = { ...id, ...(i.item as any)._value };
                (i.item as any)._valueInitial = { ...id, ...(i.item as any)._valueInitial };
                (i.item as any).markDirty();
            }
        });
    }
};