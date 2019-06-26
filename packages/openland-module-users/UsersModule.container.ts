import { container } from 'openland-modules/Modules.container';
import { UserRepository } from './repositories/UserRepository';
import { AudienceCounterRepository } from './repositories/AudienceCounterRepository';

export function loadUsersModule() {
    container.bind('UserRepository').to(UserRepository);
    container.bind('AudienceCounterRepository').to(AudienceCounterRepository);
}