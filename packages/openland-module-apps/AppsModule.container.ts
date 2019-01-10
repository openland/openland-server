import { container } from 'openland-modules/Modules.container';
import { AppsRepository } from './repositories/AppsRepository';

export function loadBotsModule() {
    container.bind('AppsRepository').to(AppsRepository);
}