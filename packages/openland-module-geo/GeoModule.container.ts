import { container } from '../openland-modules/Modules.container';
import { GeoModule } from './GeoModule';

export function loadGeoModule() {
    container.bind(GeoModule).toSelf().inSingletonScope();
}