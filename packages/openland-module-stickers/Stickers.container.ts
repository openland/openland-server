import { container } from '../openland-modules/Modules.container';
import { StickersRepository } from './repositories/StickersRepository';
import { StickersModule } from './StickersModule';

export function loadStickersModule() {
    container.bind('StickersRepository').to(StickersRepository);
    container.bind(StickersModule).toSelf().inSingletonScope();
}