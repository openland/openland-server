import { container } from 'openland-modules/Modules.container';
import { ShortnameRepository } from './repositories/ShortnameRepository';

export function loadShortnameModule() {
    container.bind('ShortnameRepository').to(ShortnameRepository);
}