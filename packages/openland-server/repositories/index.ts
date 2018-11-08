import { SuperRepository } from './SuperRepository';
import { ChatsRepository } from './ChatRepository';

export const Repos = {
    Super: new SuperRepository(),
    Chats: new ChatsRepository(),
};