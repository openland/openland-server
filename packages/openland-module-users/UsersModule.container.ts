import { container } from 'openland-modules/Modules.container';
import { UserRepository } from './repositories/UserRepository';

export function loadUsersModule() {
    container.bind('UserRepository').to(UserRepository);
}