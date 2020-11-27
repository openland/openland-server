import { container } from 'openland-modules/Modules.container';
import { UserRepository } from './repositories/UserRepository';
import { AudienceCounterRepository } from './repositories/AudienceCounterRepository';
import { UserMediator } from './mediators/UserMediator';
import { ModernBadgeMediator } from './mediators/ModernBadgeMediator';
import { ModernBadgeRepository } from './repositories/ModernBadgeRepository';

export function loadUsersModule() {
    container.bind('UserRepository').to(UserRepository);
    container.bind('UserMediator').to(UserMediator);

    container.bind('ModernBadgeMediator').to(ModernBadgeMediator);
    container.bind('ModernBadgeRepository').to(ModernBadgeRepository);

    container.bind('AudienceCounterRepository').to(AudienceCounterRepository);
}