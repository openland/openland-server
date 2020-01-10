import { container } from '../openland-modules/Modules.container';
import { PermissionsModule } from './PermissionsModule';
import { PermissionsRepository } from './PermissionsRepository';

export function loadPermissionsModule() {
    container.bind(PermissionsModule).toSelf().inSingletonScope();
    container.bind('PermissionsRepository').to(PermissionsRepository).inSingletonScope();
}