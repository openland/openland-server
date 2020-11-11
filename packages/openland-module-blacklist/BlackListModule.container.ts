import { container } from '../openland-modules/Modules.container';
import { BlackListRepository } from './repositories/BlackListRepository';
import { BlackListModule } from './BlackListModule';

export function loadBlackListModule() {
    container.bind(BlackListModule).toSelf().inSingletonScope();
    container.bind(BlackListRepository).toSelf().inSingletonScope();
}
