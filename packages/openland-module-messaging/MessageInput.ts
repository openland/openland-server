import { ImageRef } from '../openland-module-media/ImageRef';
import { FileInfo } from '../openland-module-media/FileInfo';

export type ServiceMessageMetadataType =
    'user_invite' |
    'user_kick' |
    'title_change' |
    'photo_change';

export type MessageButton = {
    title: string;
    style: 'DEFAULT' | 'LIGHT' | 'PAY';
    url: string | null;
};

export type MessageKeyboard = {
    buttons: MessageButton[][]
};

type BasicSpan<T> = { type: T, offset: number, length: number };

export type UserMentionSpan = { type: 'user_mention', offset: number, length: number, user: number };
export type MultiUserMentionSpan = { type: 'multi_user_mention', offset: number, length: number, users: number[] };
export type RoomMentionSpan = { type: 'room_mention', offset: number, length: number, room: number };
export type OrganizationMentionSpan = { type: 'organization_mention', offset: number, length: number, organization: number };
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
export type HashTagSpan = { type: 'hash_tag', offset: number, length: number, tag: string };

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
    AllMentionSpan |
    OrganizationMentionSpan |
    HashTagSpan;

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
    imagePreview: string | null,
    imageFallback: { photo: string, text: string } | null,
    socialImage: ImageRef | null;
    socialImagePreview: string | null;
    socialImageInfo: FileInfo | null;
    iconInfo: FileInfo | null,
    imageInfo: FileInfo | null,
    titleLinkHostname: string | null,
    id: string,
    keyboard: MessageKeyboard | null
    featuredIcon: boolean | null
};

export type MessageAttachmentPurchase = {
    type: 'purchase_attachment',
    pid: string,
    id: string
};

export type MessageAttachment = MessageAttachmentFile | MessageRichAttachment | MessageAttachmentPurchase;
export type RichMessageAttachment = MessageAttachmentFile | MessageRichAttachment;
export type CommentAttachment = RichMessageAttachment;

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
    imagePreview: string | null,
    imageFallback: { photo: string, text: string } | null,
    iconInfo: FileInfo | null,
    imageInfo: FileInfo | null,
    titleLinkHostname: string | null,
    keyboard: MessageKeyboard | null,
    socialImage: ImageRef | null,
    socialImagePreview: string | null,
    socialImageInfo: FileInfo | null,
    featuredIcon: boolean | null
};

export type MessageAttachmentPurchaseInput = {
  type: 'purchase_attachment',
  pid: string
};

export type MessageAttachmentInput = MessageAttachmentFileInput | MessageRichAttachmentInput | MessageAttachmentPurchaseInput;
export type RichMessageAttachmentInput = MessageAttachmentFileInput | MessageRichAttachmentInput;
export type CommentAttachmentInput = RichMessageAttachmentInput;

// Deprecated
export type MessageMention = {
    type: 'User' | 'SharedRoom'
    id: number;
};

export interface MessageInput {
    message?: string | null;

    isMuted?: boolean | null;
    isService?: boolean | null;
    visibleOnlyForUids?: number[] | null;
    repeatKey?: string | null;
    serviceMetadata?: any & { type: ServiceMessageMetadataType };
    replyMessages?: number[] | null;
    stickerId?: string | null;
    purchaseId?: string | null;

    spans?: MessageSpan[] | null;
    attachments?: MessageAttachmentInput[] | null;
    ignoreAugmentation?: boolean | null;

    // appends attachments instead of replacing them in editMessage
    appendAttachments?: boolean | null;

    // overrides
    overrideAvatar?: ImageRef | null;
    overrideName?: string | null;
}
