import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { inTx } from '@openland/foundationdb';
import { Store } from '../../openland-module-db/FDB';

@injectable()
export class ContactsRepository {
    async addContact(parent: Context, uid: number, contactId: number) {
        return await inTx(parent, async ctx => {
            let existing = await Store.Contact.findById(ctx, uid, contactId);
            if (existing) {
                existing.state = 'active';
                await existing.flush(ctx);
                return existing;
            } else {
                return await Store.Contact.create(ctx, uid, contactId, { state: 'active' });
            }
        });
    }

    async removeContact(parent: Context, uid: number, contactId: number) {
        return await inTx(parent, async ctx => {
            let existing = await Store.Contact.findById(ctx, uid, contactId);
            if (!existing) {
                return false;
            }
            existing.state = 'deleted';
            await existing.flush(ctx);
            return true;
        });
    }
}