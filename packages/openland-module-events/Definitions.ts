import {
    UpdateChatRead,
    UpdateChatMessage,
    UpdateChatMessageUpdated,
    UpdateChatMessageDeleted,
    UpdateChatGotAccess,
    UpdateChatLostAccess
} from 'openland-module-db/store';

export type Event =
    | UpdateChatRead
    | UpdateChatMessage
    | UpdateChatMessageUpdated
    | UpdateChatMessageDeleted
    | UpdateChatGotAccess
    | UpdateChatLostAccess
    ;