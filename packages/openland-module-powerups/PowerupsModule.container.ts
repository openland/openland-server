import { container } from '../openland-modules/Modules.container';
import { PowerupsModule } from './PowerupsModule';
import { PowerupsRepository } from './PowerupsRepository';

export function loadPowerupsModule() {
    container.bind(PowerupsModule).toSelf().inSingletonScope();
    container.bind('PowerupsRepository').to(PowerupsRepository).inSingletonScope();
}