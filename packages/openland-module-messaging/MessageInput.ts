import { ImageRef } from '../openland-module-media/ImageRef';
import { FileInfo } from '../openland-module-media/FileInfo';

export type ServiceMessageMetadataType =
    'user_invite' |
    'user_kick' |
    'title_change' |
    'photo_change';

export type MessageButton = {
    title: string;
    style: 'DEFAULT' | 'LIGHT';
    url: string | null;
};

export type MessageKeyboard = {
    buttons: MessageButton[][]
};

type BasicSpan<T> = { type: T, offset: number, length: number };

export type UserMentionSpan = { type: 'user_mention', offset: number, length: number, user: number };
export type MultiUserMentionSpan = { type: 'multi_user_mention', offset: number, length: number, users: number[] };
export type RoomMentionSpan = { type: 'room_mention', offset: number, length: number, room: number };
export type LinkSpan = { type: 'link', offset: number, length: number, url: string };
export type BoldTextSpan = BasicSpan<'bold_text'>;
export type ItalicTextSpan = BasicSpan<'italic_text'>;
export type IronyTextSpan = BasicSpan<'irony_text'>;
export type InlineCodeTextSpan = BasicSpan<'inline_code_text'>;
export type CodeBlockTextSpan = BasicSpan<'code_block_text'>;
export type InsaneTextSpan = BasicSpan<'insane_text'>;
export type LoudTextSpan = BasicSpan<'loud_text'>;
export type RotatingTextSpan = BasicSpan<'rotating_text'>;
export type DateTextSpan = { type: 'date_text', offset: number, length: number, date: number };
export type AllMentionSpan = BasicSpan<'all_mention'>;

export type MessageSpan =
    UserMentionSpan |
    MultiUserMentionSpan |
    RoomMentionSpan |
    LinkSpan |
    BoldTextSpan |
    ItalicTextSpan |
    IronyTextSpan |
    InlineCodeTextSpan |
    CodeBlockTextSpan |
    InsaneTextSpan |
    LoudTextSpan |
    RotatingTextSpan |
    DateTextSpan |
    AllMentionSpan;

export type FileMetadata = {
    isStored: boolean | undefined,
    isImage: boolean | null,
    imageWidth: number | null,
    imageHeight: number | null,
    imageFormat: string | null,
    mimeType: string,
    name: string,
    size: number,
};

export type MessageAttachmentFile = {
    type: 'file_attachment',
    fileId: string,
    filePreview: string | null,
    fileMetadata: FileInfo | null,
    id: string
};

export type MessageRichAttachment = {
    type: 'rich_attachment',
    title: string | null,
    subTitle: string | null,
    titleLink: string | null,
    text: string | null,
    icon: ImageRef | null,
    image: ImageRef | null,
    iconInfo: FileInfo | null,
    imageInfo: FileInfo | null,
    titleLinkHostname: string | null,
    id: string,
    keyboard: MessageKeyboard | null
};

export type MessageCommentAttachment = {
    type: 'comment_attachment',
    commentId: number,
    id: string
};

export type MessageAttachment = MessageAttachmentFile | MessageRichAttachment | MessageCommentAttachment;

export type MessageAttachmentFileInput = {
    type: 'file_attachment',
    fileId: string,
    filePreview: string | null,
    fileMetadata: FileInfo | null,
};

export type MessageRichAttachmentInput = {
    type: 'rich_attachment',
    title: string | null,
    subTitle: string | null,
    titleLink: string | null,
    text: string | null,
    icon: ImageRef | null,
    image: ImageRef | null,
    iconInfo: FileInfo | null,
    imageInfo: FileInfo | null,
    titleLinkHostname: string | null,
    keyboard: MessageKeyboard | null
};

export type MessageCommentAttachmentInput = {
    type: 'comment_attachment',
    commentId: number
};

export type MessageAttachmentInput = MessageAttachmentFileInput | MessageRichAttachmentInput | MessageCommentAttachmentInput;

// Deprecated
export type MessageMention = {
    type: 'User' | 'SharedRoom'
    id: number;
};

export interface MessageInput {
    message?: string | null;

    isMuted?: boolean | null;
    isService?: boolean | null;
    repeatKey?: string | null;
    serviceMetadata?: any & { type: ServiceMessageMetadataType };
    replyMessages?: number[] | null;

    spans?: MessageSpan[] | null;
    attachments?: MessageAttachmentInput[] | null;
    ignoreAugmentation?: boolean | null;

    // appends attachments instead of replacing them in editMessage
    appendAttachments?: boolean | null;
}