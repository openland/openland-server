import { container } from '../openland-modules/Modules.container';
import { GeoModule } from './GeoModule';
import { GeoRepository } from './GeoRepository';
import { GeoMediator } from './GeoMediator';

export function loadGeoModule() {
    container.bind(GeoModule).toSelf().inSingletonScope();
    container.bind('GeoRepository').to(GeoRepository).inSingletonScope();
    container.bind('GeoMediator').to(GeoMediator).inSingletonScope();
}