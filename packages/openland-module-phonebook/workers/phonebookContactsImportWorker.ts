import { WorkQueue } from '../../openland-module-workers/WorkQueue';
import { Store } from '../../openland-module-db/FDB';
import { Modules } from '../../openland-modules/Modules';

export function createPhoneBookContactsImportWorker() {
    let worker = new WorkQueue<{ uid: number, phones: string[] }>('phonebook_contacts_import');
    return worker;
}

export function addPhoneBookContactsImportWorker(queue: WorkQueue<{ uid: number, phones: string[] }>) {
    for (let i = 0; i <= 5; i++) {
        queue.addWorker(async (item, ctx) => {
            await Promise.all(item.phones.map(async (phone) => {
                let exitingUser = await Store.User.fromPhone.find(ctx, phone);
                if (exitingUser) {
                    await Modules.Contacts.addContact(ctx, item.uid, exitingUser.id);
                }
            }));
        });
    }
}