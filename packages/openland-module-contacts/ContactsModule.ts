import { injectable } from 'inversify';
import { ContactsRepository } from './repositories/ContactsRepository';
import { lazyInject } from '../openland-modules/Modules.container';
import { Context } from '@openland/context';

@injectable()
export class ContactsModule {
    @lazyInject(ContactsRepository)
    public readonly repo!: ContactsRepository;

    public start = async () => {
        // noop
    }

    async addContact(parent: Context, uid: number, contactId: number) {
        return this.repo.addContact(parent, uid, contactId);
    }

    async removeContact(parent: Context, uid: number, contactId: number) {
        return this.repo.removeContact(parent, uid, contactId);
    }
}