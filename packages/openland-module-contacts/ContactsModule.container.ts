import { container } from '../openland-modules/Modules.container';
import { ContactsRepository } from './repositories/ContactsRepository';

export function loadContactsModule() {
    container.bind(ContactsRepository).toSelf().inSingletonScope();
}