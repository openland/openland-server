import { WorkQueue } from '../../openland-module-workers/WorkQueue';
import { Store } from '../../openland-module-db/FDB';
import { Modules } from '../../openland-modules/Modules';
import { inTx } from '@openland/foundationdb';

export function createPhoneBookContactsImportWorker() {
    let worker = new WorkQueue<{ uid: number, phones: string[] }>('phonebook_contacts_import');
    return worker;
}

export function addPhoneBookContactsImportWorker(queue: WorkQueue<{ uid: number, phones: string[] }>) {
    for (let i = 0; i <= 5; i++) {
        queue.addWorker(async (item, ctx) => {
            await Promise.all(item.phones.map(async (phone) => {
                await inTx(ctx, async (ctx2) => {
                    let exitingUser = await Store.User.fromPhone.find(ctx2, phone);
                    if (!exitingUser) {
                        return;
                    }
                    let profile = await Store.UserProfile.findById(ctx2, exitingUser.id);
                    if (!profile) {
                        return;
                    }
                    await Modules.Contacts.addContact(ctx2, item.uid, exitingUser.id);
                });
            }));
        });
    }
}