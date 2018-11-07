import { PermissionRepository } from './PermissionRepository';
import { SuperRepository } from './SuperRepository';
import { OrganizationRepository } from './OrganizationRepository';
import { ChatsRepository } from './ChatRepository';

export const Repos = {
    Permissions: new PermissionRepository(),
    Super: new SuperRepository(),
    Organizations: new OrganizationRepository(),
    Chats: new ChatsRepository(),
};