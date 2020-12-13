import { container } from '../openland-modules/Modules.container';
import { StickersRepository } from './repositories/StickersRepository';
import { StickersModule } from './StickersModule';
import { StickersMediator } from './mediators/StickersMediator';
import { UserStickersRepository } from './repositories/UserStickersRepostory';
import { UserStickersMediator } from './mediators/UserStickersMediator';

export function loadStickersModule() {
    // Stickers
    container.bind('StickersRepository').to(StickersRepository);
    container.bind('StickersMediator').to(StickersMediator);

    // User stickers
    container.bind('UserStickersRepository').to(UserStickersRepository);
    container.bind('UserStickersMediator').to(UserStickersMediator);

    container.bind(StickersModule).toSelf().inSingletonScope();
}