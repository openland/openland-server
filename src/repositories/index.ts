import { AreaRepository } from './AreaRepository';
import { PermissionRepository } from './PermissionRepository';
import { IncidentsRepository } from './IncidentsRepository';

export const Repos = {
    Area: new AreaRepository(),
    Permissions: new PermissionRepository(),
    Incidents: new IncidentsRepository()
};