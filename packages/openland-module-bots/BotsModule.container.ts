import { container } from 'openland-modules/Modules.container';
import { BotsRepository } from './repositories/BotsRepository';

export function loadBotsModule() {
    container.bind('BotsRepository').to(BotsRepository);
}