import { PermissionRepository } from './PermissionRepository';
import { SuperRepository } from './SuperRepository';
import { ChatsRepository } from './ChatRepository';

export const Repos = {
    Permissions: new PermissionRepository(),
    Super: new SuperRepository(),
    Chats: new ChatsRepository(),
};