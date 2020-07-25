import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { inTx } from '@openland/foundationdb';
import { Store } from '../../openland-module-db/FDB';
import { ContactAddedEvent, ContactRemovedEvent } from '../../openland-module-db/store';

@injectable()
export class ContactsRepository {
    async addContact(parent: Context, uid: number, contactId: number) {
        return await inTx(parent, async ctx => {
            let existing = await Store.Contact.findById(ctx, uid, contactId);
            if (existing && existing.state === 'active') {
                return existing;
            } else if (existing && existing.state !== 'active') {
                existing.state = 'active';
                await existing.flush(ctx);
                await Store.UserContactsEventStore.post(ctx, uid, ContactAddedEvent.create({ uid, contactUid: contactId }));
                return existing;
            } else {
                await Store.UserContactsEventStore.post(ctx, uid, ContactAddedEvent.create({ uid, contactUid: contactId }));
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
            if (existing.state === 'deleted') {
                return false;
            }
            existing.state = 'deleted';
            await existing.flush(ctx);
            await Store.UserContactsEventStore.post(ctx, uid, ContactRemovedEvent.create({ uid, contactUid: contactId }));
            return true;
        });
    }
}