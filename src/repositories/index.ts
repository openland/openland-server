import { AreaRepository } from './AreaRepository';
import { PermissionRepository } from './PermissionRepository';
import { IncidentsRepository } from './IncidentsRepository';
import { BlockRepository } from './BlockRepositroy';
import { ParcelRepository } from './ParcelRepository';
import { TokenRepository } from './TokenRepository';
import { UserRepository } from './UserRepository';
import { SuperRepository } from './SuperRepository';
import { OpportunitiesRepository } from './OpportunitiesRepository';
import { FoldersRepository } from './FoldersRepository';
import { OrganizationRepository } from './OrganizationRepository';

export const Repos = {
    Area: new AreaRepository(),
    Permissions: new PermissionRepository(),
    Incidents: new IncidentsRepository(),
    Blocks: new BlockRepository(),
    Parcels: new ParcelRepository(),
    Tokens: new TokenRepository(),
    Users: new UserRepository(),
    Super: new SuperRepository(),
    Opportunities: new OpportunitiesRepository(),
    Folders: new FoldersRepository(),
    Organizations: new OrganizationRepository()
};