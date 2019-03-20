import { URLAugmentation } from './workers/UrlInfoService';
import { JsonMap } from 'openland-utils/json';

export type ServiceMessageMetadataType =
    'user_invite' |
    'user_kick' |
    'title_change' |
    'photo_change';

type MessageType = 'MESSAGE' | 'POST';

export type MessageButton = {
    id: string;
    title: string;
    style: 'DEFAULT' | 'LIGHT';
    url?: string;
};

export type MessageKeyboard = {
    buttons: MessageButton[][]
};

export type MessageAttachment = {
    fileId: string;
    fileMetadata: JsonMap | null;
    filePreview?: string | null;
};

export type MessageMention = {
    type: 'User' | 'SharedRoom'
    id: number;
};

export type UserMentionSpan = { type: 'user_mention', offset: number, length: number, user: number };
export type MultiUserMentionSpan = { type: 'multi_user_mention', offset: number, length: number, users: number[] };
export type RoomMentionSpan = { type: 'room_mention', offset: number, length: number, room: number };
export type LinkSpan = { type: 'link', offset: number, length: number, url: string, text: string };
export type MessageSpan = UserMentionSpan | MultiUserMentionSpan | RoomMentionSpan | LinkSpan;

export interface MessageInput {
    message?: string | null;
    file?: string | null;
    fileMetadata?: JsonMap | null;
    filePreview?: string | null;
    isMuted?: boolean | null;
    isService?: boolean | null;
    repeatKey?: string | null;
    serviceMetadata?: any & { type: ServiceMessageMetadataType };
    urlAugmentation?: URLAugmentation | null | false;
    replyMessages?: number[] | null;
    mentions?: number[] | null;

    type?: MessageType;
    title?: string | null;
    buttons?: MessageButton[][] | null;
    attachments?: MessageAttachment[] | null;
    postType?: string | null;
    complexMentions?: MessageMention[] | null;
    ignoreAugmentation?: boolean | null;
    spans?: MessageSpan[] | null;
}