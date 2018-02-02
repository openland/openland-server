import { AreaRepository } from './AreaRepository';
import { PermissionRepository } from './PermissionRepository';

export const Repos = {
    Area: new AreaRepository(),
    Permissions: new PermissionRepository()
};