import { PermissionRepository } from './PermissionRepository';
import { TokenRepository } from './TokenRepository';
import { UserRepository } from './UserRepository';
import { SuperRepository } from './SuperRepository';
import { OrganizationRepository } from './OrganizationRepository';
import { ChatsRepository } from './ChatRepository';
import InvitesRepository from './InvitesRepository';
import { PhoneRepository } from './PhoneRepository';

export const Repos = {
    Permissions: new PermissionRepository(),
    Tokens: new TokenRepository(),
    Users: new UserRepository(),
    Super: new SuperRepository(),
    Organizations: new OrganizationRepository(),
    Chats: new ChatsRepository(),
    Invites: new InvitesRepository(),
    Phones: new PhoneRepository()
};