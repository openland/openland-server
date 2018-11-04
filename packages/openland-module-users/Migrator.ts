import { UpdateReader } from 'openland-server/modules/updateReader';
import { DB } from 'openland-server/tables';
import { FDB } from 'openland-module-db/FDB';
import { inTx } from 'foundation-orm/inTx';

export function startMigrator() {
    let reader = new UpdateReader('users-import', 1, DB.User);
    reader.processor(async (items) => {
        for (let i of items) {
            await inTx(async () => {
                let c = await FDB.Sequence.findById('user-id');
                if (!c) {
                    c = await FDB.Sequence.create('user-id', { value: 0 });
                    await c.flush();
                }
                c.value = Math.max(c.value, i.id!);
                let ex = await FDB.User.findById(i.id!);
                if (!ex) {
                    await FDB.User.create(i.id!, {
                        authId: i.authId!,
                        email: i.email!,
                        isBot: i.isBot!,
                        invitedBy: i.invitedBy,
                        botOwner: i.extras && i.extras.botOwner as any,
                        status:
                            i.status === 'PENDING' ? 'pending'
                                : (i.status === 'ACTIVATED' ? 'activated' : 'suspended')
                    });
                } else {
                    ex.status = i.status === 'PENDING' ? 'pending'
                    : (i.status === 'ACTIVATED' ? 'activated' : 'suspended');
                }
            });
        }
    });
    reader.start();
}