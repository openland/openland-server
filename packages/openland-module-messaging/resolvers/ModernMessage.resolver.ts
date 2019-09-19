import { RichMessage, UserBadge } from 'openland-module-db/store';
import { GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
import { withUser } from '../../openland-module-api/Resolvers';
import { IDs } from '../../openland-module-api/IDs';
import { Modules } from '../../openland-modules/Modules';
import { Comment, Message } from '../../openland-module-db/store';
import { Context } from '@openland/context';
import { GQLRoots } from '../../openland-module-api/schema/SchemaRoots';
import MessageSpanRoot = GQLRoots.MessageSpanRoot;
import { UserError } from '../../openland-errors/UserError';
import ModernMessageAttachmentRoot = GQLRoots.ModernMessageAttachmentRoot;
import { buildBaseImageUrl } from '../../openland-module-media/ImageRef';
import { LinkSpan, MessageAttachment, MessageAttachmentInput, MessageSpan } from '../MessageInput';
import { createUrlInfoService, URLAugmentation } from '../workers/UrlInfoService';
import { Texts } from '../texts';
import { createLinkifyInstance } from '../../openland-utils/createLinkifyInstance';
import { MessageMention } from '../MessageInput';
import { AppContext } from 'openland-modules/AppContext';
import { Store } from 'openland-module-db/FDB';
import MessageSourceRoot = GQLRoots.MessageSourceRoot;

export function hasMention(message: Message|RichMessage, uid: number) {
    if (message.spans && message.spans.find(s => (s.type === 'user_mention' && s.user === uid) || (s.type === 'multi_user_mention' && s.users.indexOf(uid) > -1))) {
        return true;
    } else if (message.spans && message.spans.find(s => s.type === 'all_mention')) {
        return true;
    } else if (message instanceof Message && message.mentions && message.mentions.indexOf(uid) > -1) {
        return true;
    } else if (message instanceof Message && message.complexMentions && message.complexMentions.find((m: MessageMention) => m.type === 'User' && m.id === uid)) {
        return true;
    }
    return false;
}

export const REACTIONS_LEGACY = new Map([
    ['❤️', 'LIKE'],
    ['👍', 'THUMB_UP'],
    ['😂', 'JOY'],
    ['😱', 'SCREAM'],
    ['😢', 'CRYING'],
    ['🤬', 'ANGRY'],
]);

export const REACTIONS = ['LIKE', 'THUMB_UP', 'JOY', 'SCREAM', 'CRYING', 'ANGRY'];
const DELETED_TEXT = {
    MESSAGE: 'This message has been deleted',
    COMMENT: 'This comment has been deleted'
};

const getDeletedText = (src: Message | Comment | RichMessage) => src instanceof Comment ? DELETED_TEXT.COMMENT : DELETED_TEXT.MESSAGE;

type IntermediateMention = { type: 'user', user: number } | { type: 'room', room: number };

export async function prepareLegacyMentionsInput(ctx: Context, messageText: string, mentions: number[]): Promise<MessageSpan[]> {
    let spans: MessageSpan[] = [];
    if (mentions.length > 0) {
        let offsets = new Set<number>();

        function getOffset(str: string, n: number = 0): number {
            let offset = messageText.indexOf(str, n);
            if (offset === -1) {
                return -1;
            }

            if (offsets.has(offset)) {
                return getOffset(str, n + 1);
            }

            offsets.add(offset);
            return offset;
        }

        for (let mention of mentions) {
            let userName = await Modules.Users.getUserFullName(ctx, mention);
            let mentionText = '@' + userName;

            let index = getOffset(mentionText);

            if (index > -1) {
                spans.push({
                    type: 'user_mention',
                    offset: index,
                    length: mentionText.length,
                    user: mention
                });
            }
        }
    }

    return spans;
}

async function prepareLegacyMentions(ctx: Context, message: Message, uid: number): Promise<MessageSpan[]> {
    let messageText = message.text || '';

    if (messageText.length === 0) {
        return [];
    }

    let intermediateMentions: IntermediateMention[] = [];
    let spans: MessageSpan[] = [];

    //
    //  Legacy user mentions
    //
    if (message.mentions) {
        for (let m of message.mentions) {
            intermediateMentions.push({ type: 'user', user: m });
        }
    }

    //
    // Legacy complex mentions
    //
    if (message.complexMentions) {
        for (let m of message.complexMentions) {
            if (m.type === 'User') {
                intermediateMentions.push({ type: 'user', user: m.id });
            } else if (m.type === 'SharedRoom') {
                intermediateMentions.push({ type: 'room', room: m.id });
            } else {
                throw new Error('Unknown mention type: ' + m.type);
            }
        }
    }

    //
    // Multi-user join service message
    //
    let multiUserJoinRegexp = /along with (\d?) others/;
    if (message.isService && message.serviceMetadata && message.serviceMetadata.type === 'user_invite' && multiUserJoinRegexp.test(messageText)) {
        let [, _usersJoined] = multiUserJoinRegexp.exec(messageText)!;
        let usersJoined = parseInt(_usersJoined, 10);
        let othersText = usersJoined + ' others';
        let othersMentions = intermediateMentions.splice(-usersJoined);
        spans.push({
            type: 'multi_user_mention',
            offset: messageText.length - othersText.length,
            length: othersText.length,
            users: othersMentions.map((v: any) => v.user)
        });
    }
    let offsets = new Set<number>();

    function getOffset(str: string, n: number = 0): number {
        let offset = messageText.indexOf(str, n);
        if (offset === -1) {
            return -1;
        }

        if (offsets.has(offset)) {
            return getOffset(str, n + 1);
        }

        offsets.add(offset);
        return offset;
    }

    //
    //  Kick service message
    //
    if (message.isService && message.serviceMetadata && message.serviceMetadata.type === 'user_kick' && !message.complexMentions) {
        let userName = await Modules.Users.getUserFullName(ctx, message.serviceMetadata.userId);
        let kickerUserName = await Modules.Users.getUserFullName(ctx, message.serviceMetadata.kickedById);

        let index1 = getOffset(userName);
        if (index1 > -1) {
            spans.push({
                type: 'user_mention',
                offset: index1,
                length: userName.length,
                user: message.serviceMetadata.userId
            });
        }
        let index2 = getOffset(kickerUserName);
        if (index2 > -1) {
            spans.push({
                type: 'user_mention',
                offset: index2,
                length: kickerUserName.length,
                user: message.serviceMetadata.kickedById
            });
        }
    }

    for (let mention of intermediateMentions) {
        if (mention.type === 'user') {
            let userName = await Modules.Users.getUserFullName(ctx, mention.user);
            let mentionText = '@' + userName;

            let index = getOffset(mentionText);

            if (index > -1) {
                spans.push({
                    type: 'user_mention',
                    offset: index,
                    length: mentionText.length,
                    user: mention.user
                });
            }
        } else if (mention.type === 'room') {
            let roomName = await Modules.Messaging.room.resolveConversationTitle(ctx, mention.room, uid);
            let mentionText = '@' + roomName;

            let index = getOffset(mentionText);

            if (index > -1) {
                spans.push({
                    type: 'room_mention',
                    offset: index,
                    length: mentionText.length,
                    room: mention.room
                });
            }
        }
    }

    return spans;
}

const linkifyInstance = createLinkifyInstance();

export function parseLinks(message: string): MessageSpan[] {
    let urls = linkifyInstance.match(message);

    if (!urls) {
        return [];
    }

    let offsets = new Set<number>();

    function getOffset(str: string, n: number = 0): number {
        let offset = message.indexOf(str, n);

        if (offsets.has(offset)) {
            return getOffset(str, n + 1);
        }

        offsets.add(offset);
        return offset;
    }

    return urls.map(url => ({
        type: 'link',
        offset: getOffset(url.raw),
        length: url.raw.length,
        url: url.url,
    } as LinkSpan));
}

const urlInfoService = createUrlInfoService();

export async function fetchMessageFallback(message: Message | Comment | RichMessage): Promise<string> {
    const attachFallback = (mime?: string | null, isImage?: boolean | null) => {
        if (!mime) {
            return Texts.Notifications.DOCUMENT_ATTACH;
        } else if (mime === 'image/gif') {
            return Texts.Notifications.GIF_ATTACH;
        } else if (isImage) {
            return Texts.Notifications.IMAGE_ATTACH;
        } else if (mime.startsWith('video/')) {
            return Texts.Notifications.VIDEO_ATTACH;
        } else {
            return Texts.Notifications.DOCUMENT_ATTACH;
        }
    };

    let fallback: string[] = [];

    if (message.text) {
        fallback.push(message.text);
    }
    if ((message instanceof Message || message instanceof Comment) && message.stickerId) {
        fallback.push(Texts.Notifications.STICKER);
    }
    if (message instanceof Message && message.fileMetadata) {
        fallback.push(attachFallback(message.fileMetadata && message.fileMetadata.mimeType, message.fileMetadata && message.fileMetadata.isImage));
    }
    let attachments = message instanceof Message ? message.attachmentsModern : message.attachments;
    if (attachments) {
        for (let attach of attachments) {
            if (attach.type === 'file_attachment') {
                fallback.push(attachFallback(attach.fileMetadata && attach.fileMetadata.mimeType, attach.fileMetadata && attach.fileMetadata.isImage));
            } else if (attach.type === 'rich_attachment') {
                if (attach.title) {
                    fallback.push(attach.title);
                }
                if (attach.subTitle) {
                    fallback.push(attach.subTitle);
                }
                if (attach.text) {
                    fallback.push(attach.text);
                }
                if (attach.titleLink) {
                    fallback.push(attach.titleLink);
                }
                if (attach.imageInfo) {
                    fallback.push(attachFallback(attach.imageInfo.mimeType, attach.imageInfo.isImage));
                }
            }
        }
    }

    if (message instanceof Message && message.replyMessages && message.replyMessages.length > 0) {
        fallback.push(Texts.Notifications.REPLY_ATTACH);
    }

    return fallback.join('\n');
}

async function getMessageSenderBadge(ctx: AppContext, src: Message | Comment): Promise<UserBadge | null> {
    let cid: number | undefined = undefined;

    if (src instanceof Message) {
        cid = src.cid;
    } else if (src instanceof Comment && src.peerType === 'message') {
        let message = await Store.Message.findById(ctx, src.peerId);
        cid = message!.cid;
    }

    return await Modules.Users.getUserBadge(ctx, src.uid, cid);
}

export default {
    ModernMessage: {
        __resolveType(src: Message | Comment) {
            if (src.stickerId) {
                return 'StickerMessage';
            } else if (src instanceof Comment) {
                return 'GeneralMessage';
            } else if (src.isService) {
                return 'ServiceMessage';
            } else {
                return 'GeneralMessage';
            }
        }
    },
    ServiceMessage: {
        //
        //  State
        //
        id: src => {
            if (src instanceof Comment) {
                return IDs.Comment.serialize(src.id);
            } else if (src instanceof Message) {
                return IDs.ConversationMessage.serialize(src.id);
            }
            throw new Error('unknown message ' + src);
        },
        date: src => src.metadata.createdAt,
        sender: src => src.uid,
        senderBadge: (src, args, ctx) => getMessageSenderBadge(ctx, src),
        isMentioned: (src, args, ctx) => {
            if (src instanceof Message) {
                return hasMention(src, ctx.auth.uid!);
            }
            return false;
        },
        source: (src, args, ctx) => src,

        //
        //  Content
        //
        message: src => src.text,
        spans: async (src, args, ctx) => {
            //
            //  Modern spans
            //
            if (src.spans) {
                return src.spans
                    .map(span => {
                        if (span.type === 'all_mention') {
                            return {
                                type: 'user_mention',
                                offset: span.offset,
                                length: span.length,
                                user: ctx.auth.uid!
                            };
                        } else {
                            return span;
                        }
                    })
                    .filter(span => span.type !== 'date_text');
            }

            let uid = ctx.auth.uid!;
            let spans: MessageSpan[] = [];

            //
            //  Legacy data support
            //
            spans.push(...await prepareLegacyMentions(ctx, src, uid));

            //
            //  Links
            //
            spans.push(...parseLinks(src.text || ''));

            return spans;
        },
        serviceMetadata: (src: Message) => {
            if (src.serviceMetadata && (src.serviceMetadata as any).type) {
                return src.serviceMetadata;
            }

            return null;
        },
        fallback: src => fetchMessageFallback(src)
    },
    GeneralMessage: {
        //
        //  State
        //
        id: src => {
            if (src instanceof Comment) {
                return IDs.Comment.serialize(src.id);
            } else if (src instanceof Message) {
                return IDs.ConversationMessage.serialize(src.id);
            } else if (src instanceof RichMessage) {
                return IDs.RichMessage.serialize(src.id);
            }
            throw new Error('unknown message ' + src);
        },
        date: src => src.metadata.createdAt,
        sender: async (src, args, ctx) => {
            // message can be deleted, while sender can be alive or deleted 

            if (src.deleted) {
                const deletedUserId = await Modules.Users.getDeletedUserId(ctx);
                if (deletedUserId) {
                    return deletedUserId;
                }
            }
            return src.uid;
        },
        senderBadge: (src, args, ctx) => src instanceof RichMessage ? null : src.deleted ? null : getMessageSenderBadge(ctx, src),
        edited: src => src.edited || false,
        reactions: src => src.reactions || [],
        isMentioned: async (src, args, ctx) => {
            if (src instanceof Message) {
                return hasMention(src, ctx.auth.uid!);
            }
            return false;
        },
        source: (src, args, ctx) => src,

        //
        //  Content
        //
        message: src => {
            if (src.deleted) {
                return getDeletedText(src);
            }
            if (src instanceof Message && src.type && src.type === 'POST') {
                return null;
            }
            return src.text;
        },
        spans: async (src, args, ctx) => {
            if (src.deleted) {
                return [{
                    type: 'italic_text',
                    offset: 0,
                    length: getDeletedText(src).length,
                }];
            }
            //
            //  Modern spans
            //
            if (src.spans) {
                return (src.spans as MessageSpan[])
                    .map(span => {
                        if (span.type === 'all_mention') {
                            return {
                                type: 'user_mention',
                                offset: span.offset,
                                length: span.length,
                                user: ctx.auth.uid!
                            };
                        } else {
                            return span;
                        }
                    })
                    .filter(span => span.type !== 'date_text');
            } else if (src instanceof Comment || src instanceof RichMessage) {
                return [];
            }

            let uid = ctx.auth.uid!;
            let spans: MessageSpan[] = [];

            //
            //  Legacy data support
            //
            spans.push(...await prepareLegacyMentions(ctx, src, uid));

            //
            //  Links
            //
            spans.push(...parseLinks(src.text || ''));

            return spans;
        },
        attachments: async (src, args, ctx) => {
            if (src.deleted) {
                return [];
            }
            if (src instanceof Comment || src instanceof RichMessage) {
                return src.attachments ? src.attachments.map(a => ({ message: src, attachment: a })) : [];
            }

            let attachments: { attachment: MessageAttachment, message: Message }[] = [];

            if (src.fileId) {
                attachments.push({
                    message: src,
                    attachment: {
                        type: 'file_attachment',
                        fileId: src.fileId,
                        filePreview: src.filePreview || null,
                        fileMetadata: src.fileMetadata ? {
                            name: src.fileMetadata.name,
                            mimeType: src.fileMetadata.mimeType,
                            isStored: src.fileMetadata.isStored || true,
                            isImage: !!(src.fileMetadata.isImage),
                            imageWidth: src.fileMetadata.imageWidth,
                            imageHeight: src.fileMetadata.imageHeight,
                            imageFormat: src.fileMetadata.imageFormat,
                            size: src.fileMetadata.size
                        } : null,
                        id: src.id + '_legacy_file'
                    }
                });
            }
            if (src.augmentation) {
                let augmentation: URLAugmentation = src.augmentation;
                if (augmentation.dynamic) {
                    let newAugmentation = await urlInfoService.fetchURLInfo(augmentation.url, false);
                    if (newAugmentation) {
                        augmentation = newAugmentation;
                    }
                }

                attachments.push({
                    message: src,
                    attachment: {
                        type: 'rich_attachment',
                        title: augmentation.title || null,
                        titleLink: augmentation.url,
                        titleLinkHostname: augmentation.hostname || null,
                        subTitle: augmentation.subtitle || null,
                        text: augmentation.description || null,
                        icon: augmentation.iconRef || null,
                        iconInfo: augmentation.iconInfo || null,
                        image: augmentation.photo || null,
                        imagePreview: augmentation.photoPreview || null,
                        imageInfo: augmentation.imageInfo || null,
                        keyboard: augmentation.keyboard || null,
                        imageFallback: null,
                        id: src.id + '_legacy_rich'
                    }
                });
            }
            if (src.type && src.type === 'POST') {
                attachments.push({
                    message: src,
                    attachment: {
                        type: 'rich_attachment',
                        title: src.title || '',
                        titleLink: null,
                        titleLinkHostname: null,
                        subTitle: null,
                        text: src.text || '',
                        icon: null,
                        iconInfo: null,
                        image: null,
                        imagePreview: null,
                        imageInfo: null,
                        keyboard: null,
                        imageFallback: null,
                        id: src.id + '_legacy_post'
                    }
                });
            }
            if (src.attachments) {
                let i = 0;
                for (let attachment of src.attachments) {
                    attachments.push({
                        message: src,
                        attachment: {
                            type: 'file_attachment',
                            fileId: attachment.fileId,
                            filePreview: attachment.filePreview || undefined,
                            fileMetadata: attachment.fileMetadata,
                            id: src.id + '_legacy_file_' + i
                        }
                    });
                    i++;
                }
            }
            if (src.attachmentsModern) {
                attachments.push(...(src.attachmentsModern.map(a => ({ message: src, attachment: a }))));
            }

            return attachments;
        },
        quotedMessages: async (src, args, ctx) => {
            if (src.deleted) {
                return [];
            }
            if (src instanceof Comment || src instanceof RichMessage) {
                return [];
            }
            if (src.replyMessages) {
                let messages = await Promise.all((src.replyMessages as number[]).map(id => Store.Message.findById(ctx, id)));
                let filtered = messages.filter(m => !!m);
                if (filtered.length > 0) {
                    return filtered;
                }
                return [];
            }
            return [];
        },
        commentsCount: async (src, argx, ctx) => {
            if (src instanceof Comment) {
                return 0;
            }

            let state = await Store.CommentState.findById(ctx, 'message', src.id);
            return (state && state.commentsCount) || 0;
        },
        fallback: src => fetchMessageFallback(src)
    },
    StickerMessage: {
        //
        //  State
        //
        id: src => {
            if (src instanceof Comment) {
                return IDs.Comment.serialize(src.id);
            } else if (src instanceof Message) {
                return IDs.ConversationMessage.serialize(src.id);
            }
            throw new Error('unknown message ' + src);
        },
        date: src => src.metadata.createdAt,
        sender: async (src, args, ctx) => {
            // message can be deleted, while sender can be alive or deleted

            if (src.deleted) {
                const deletedUserId = await Modules.Users.getDeletedUserId(ctx);
                if (deletedUserId) {
                    return deletedUserId;
                }
            }
            return src.uid;
        },
        senderBadge: (src, args, ctx) => src.deleted ? null : getMessageSenderBadge(ctx, src),
        reactions: src => src.reactions || [],
        source: (src, args, ctx) => src,
        sticker: (src) => src.stickerId,

        //
        //  Content
        //
        message: src => null,
        spans: src => [],
        quotedMessages: async (src, args, ctx) => {
            if (src.deleted) {
                return [];
            }
            if (src instanceof Comment) {
                return [];
            }
            if (src.replyMessages) {
                let messages = await Promise.all((src.replyMessages as number[]).map(id => Store.Message.findById(ctx, id)));
                let filtered = messages.filter(m => !!m);
                if (filtered.length > 0) {
                    return filtered;
                }
                return [];
            }
            return [];
        },
        commentsCount: async (src, argx, ctx) => {
            if (src instanceof Comment) {
                return 0;
            }

            let state = await Store.CommentState.findById(ctx, 'message', src.id);
            return (state && state.commentsCount) || 0;
        },
        fallback: src => fetchMessageFallback(src)
    },

    //
    // Message source
    //
    MessageSource: {
        __resolveType(src: MessageSourceRoot) {
            if (src instanceof Message) {
                return 'MessageSourceChat';
            } else if (src instanceof Comment) {
                return 'MessageSourceComment';
            }
            throw new Error('Unknown message source: ' + src);
        }
    },
    MessageSourceChat: {
        chat: src => src.cid
    },
    MessageSourceComment: {
        peer: async (src, args, ctx) => {
            return {
                comments: (await Store.Comment.peer.findAll(ctx, src.peerType, src.peerId)).filter(c => c.visible),
                peerType: src.peerType,
                peerId: src.peerId,
            };
        }
    },

    ModernMessageReaction: {
        user: src => src.userId,
        reaction: src => {
            // modern
            if (REACTIONS.indexOf(src.reaction) > -1) {
                return src.reaction;
            }
            // old
            if (REACTIONS_LEGACY.has(src.reaction)) {
                return REACTIONS_LEGACY.get(src.reaction);
            }
            return 'LIKE';
        }
    },

    //
    //  Rich text
    //
    MessageSpan: {
        __resolveType(src: MessageSpanRoot) {
            if (src.type === 'user_mention') {
                return 'MessageSpanUserMention';
            } else if (src.type === 'room_mention') {
                return 'MessageSpanRoomMention';
            } else if (src.type === 'link') {
                return 'MessageSpanLink';
            } else if (src.type === 'multi_user_mention') {
                return 'MessageSpanMultiUserMention';
            } else if (src.type === 'bold_text') {
                return 'MessageSpanBold';
            } else if (src.type === 'italic_text') {
                return 'MessageSpanItalic';
            } else if (src.type === 'irony_text') {
                return 'MessageSpanIrony';
            } else if (src.type === 'inline_code_text') {
                return 'MessageSpanInlineCode';
            } else if (src.type === 'code_block_text') {
                return 'MessageSpanCodeBlock';
            } else if (src.type === 'insane_text') {
                return 'MessageSpanInsane';
            } else if (src.type === 'loud_text') {
                return 'MessageSpanLoud';
            } else if (src.type === 'rotating_text') {
                return 'MessageSpanRotating';
            } else if (src.type === 'date_text') {
                return 'MessageSpanDate';
            } else if (src.type === 'all_mention') {
                return 'MessageSpanAllMention';
            } else {
                throw new UserError('Unknown message span type: ' + (src as any).type);
            }
        }
    },
    MessageSpanUserMention: {
        offset: src => src.offset,
        length: src => src.length,
        user: src => src.user
    },
    MessageSpanMultiUserMention: {
        offset: src => src.offset,
        length: src => src.length,
        users: src => src.users
    },
    MessageSpanRoomMention: {
        offset: src => src.offset,
        length: src => src.length,
        room: src => src.room
    },
    MessageSpanLink: {
        offset: src => src.offset,
        length: src => src.length,
        url: src => src.url,
    },
    MessageSpanBold: {
        offset: src => src.offset,
        length: src => src.length,
    },

    //
    //  Attachments
    //
    ImageFallback: {
        photo: src => src.photo,
        text: src => src.text
    },
    Image: {
        url: src => buildBaseImageUrl({ uuid: src.uuid, crop: src.crop || null }),
        metadata: src => {
            if (src.metadata) {
                return {
                    name: src.metadata.name,
                    mimeType: src.metadata.mimeType,
                    isImage: !!(src.metadata.isImage),
                    imageWidth: src.metadata.imageWidth,
                    imageHeight: src.metadata.imageHeight,
                    imageFormat: src.metadata.imageFormat,
                    size: src.metadata.size
                };
            }
            return null;
        },
    },
    ModernMessageAttachment: {
        __resolveType(src: ModernMessageAttachmentRoot) {
            if (src.attachment.type === 'file_attachment') {
                return 'MessageAttachmentFile';
            } else if (src.attachment.type === 'rich_attachment') {
                return 'MessageRichAttachment';
            } else {
                throw new UserError('Unknown message attachment type: ' + (src as any).type);
            }
        }
    },
    MessageAttachmentFile: {
        id: src => IDs.MessageAttachment.serialize(src.attachment.id),
        fileId: src => src.attachment.fileId,
        fileMetadata: src => {
            if (src.attachment.fileId && src.attachment.fileMetadata) {
                let metadata = src.attachment.fileMetadata;
                return {
                    name: metadata.name,
                    mimeType: metadata.mimeType,
                    isImage: !!(metadata.isImage),
                    imageWidth: metadata.imageWidth,
                    imageHeight: metadata.imageHeight,
                    imageFormat: metadata.imageFormat,
                    size: metadata.size
                };
            } else {
                return null;
            }
        },
        filePreview: src => src.attachment.filePreview,
        fallback: src => 'File attachment'
    },
    MessageRichAttachment: {
        id: src => IDs.MessageAttachment.serialize(src.attachment.id),
        title: src => src.attachment.title,
        subTitle: src => src.attachment.subTitle,
        titleLink: src => src.attachment.titleLink,
        titleLinkHostname: src => src.attachment.titleLinkHostname,
        text: src => src.attachment.text,
        icon: src => src.attachment.icon && {
            uuid: src.attachment.icon.uuid,
            metadata: src.attachment.iconInfo,
            crop: src.attachment.icon.crop
        },
        image: src => src.attachment.image && {
            uuid: src.attachment.image.uuid,
            metadata: src.attachment.imageInfo,
            crop: src.attachment.image.crop,
            fallback: src.attachment.imageFallback
        },
        imageFallback: src => src.attachment.imageFallback,
        imagePreview: src => src.attachment.imagePreview,
        fallback: src => src.attachment.title ? src.attachment.title : src.attachment.text ? src.attachment.text : src.attachment.titleLink ? src.attachment.titleLink : 'unsupported',
        keyboard: src => {
            if (!src.attachment.keyboard) {
                return null;
            }

            let btnIndex = 0;
            for (let line of src.attachment.keyboard.buttons) {
                for (let button of line) {
                    (button as any).id = IDs.KeyboardButton.serialize(`${src.message.id}_${src.attachment.id}_${btnIndex}`);
                    btnIndex++;
                }
            }

            return src.attachment.keyboard;
        }
    },

    Query: {
        messages: withUser(async (ctx, args, uid) => {
            let roomId = IDs.Conversation.parse(args.chatId);
            let beforeId = args.before ? IDs.ConversationMessage.parse(args.before) : null;
            await Modules.Messaging.room.checkAccess(ctx, uid, roomId);
            if (!args.first || args.first <= 0) {
                return [];
            }
            if (args.before && await Store.Message.findById(ctx, beforeId!)) {
                return (await Store.Message.chat.query(ctx, roomId, { after: beforeId!, limit: args.first!, reverse: true })).items;
            }
            return (await Store.Message.chat.query(ctx, roomId, { limit: args.first!, reverse: true })).items;
        }),

        gammaMessages: withUser(async (ctx, args, uid) => {
            let roomId = IDs.Conversation.parse(args.chatId);
            await Modules.Messaging.room.checkAccess(ctx, uid, roomId);
            if (!args.first || args.first <= 0) {
                return [];
            }

            let aroundId = args.around ? IDs.ConversationMessage.parse(args.around) : null;

            if (!aroundId && !args.before && !args.after) {
                aroundId = await Store.UserDialogReadMessageId.get(ctx, uid, roomId);
            }

            let beforeId = aroundId || (args.before ? IDs.ConversationMessage.parse(args.before) : null);
            let afterId = aroundId || (args.after ? IDs.ConversationMessage.parse(args.after) : null);

            let haveMoreForward: boolean | undefined;
            let haveMoreBackward: boolean | undefined;
            let messages: Message[] = [];

            if (beforeId || afterId) {
                let before: Message[] = [];
                let after: Message[] = [];

                if (beforeId && await Store.Message.findById(ctx, beforeId)) {
                    let beforeQuery = (await Store.Message.chat.query(ctx, roomId, { after: beforeId, limit: args.first!, reverse: true }));
                    before = beforeQuery.items;
                    haveMoreBackward = beforeQuery.haveMore;
                }
                if (afterId && await Store.Message.findById(ctx, afterId)) {
                    let afterQuery = (await Store.Message.chat.query(ctx, roomId, { after: afterId, limit: args.first! }));
                    after = afterQuery.items.reverse();
                    haveMoreForward = afterQuery.haveMore;
                }
                let aroundMessage: Message | undefined | null;
                if (aroundId) {
                    aroundMessage = await Store.Message.findById(ctx, aroundId);
                }

                messages = [...after, ...(aroundMessage && !aroundMessage.deleted) ? [aroundMessage] : [], ...before];
            } else {
                haveMoreForward = false;
                let beforeQuery = (await Store.Message.chat.query(ctx, roomId, { limit: args.first!, reverse: true, }));
                messages = beforeQuery.items;
                haveMoreBackward = beforeQuery.haveMore;
            }

            return {
                haveMoreForward,
                haveMoreBackward,
                messages
            };
        }),

        message: withUser(async (ctx, args, uid) => {
            let messageId = IDs.ConversationMessage.parse(args.messageId);
            let msg = await Store.Message.findById(ctx, messageId);
            if (!msg) {
                return null;
            }

            await Modules.Messaging.room.checkAccess(ctx, uid, msg.cid);

            return msg;
        }),
        lastReadedMessage: withUser(async (ctx, args, uid) => {
            let chatId = IDs.Conversation.parse(args.chatId);
            let readMessageId = await Store.UserDialogReadMessageId.get(ctx, uid, chatId);
            let msg = (readMessageId !== 0) && await Store.Message.findById(ctx, readMessageId);

            if (msg && msg.deleted) {
                let msgs = (await Store.Message.chat.query(ctx, chatId, { after: readMessageId, limit: 1, reverse: true })).items;
                msg = msgs[msgs.length - 1];
            }

            if (!msg) {
                return null;
            }

            await Modules.Messaging.room.checkAccess(ctx, uid, msg.cid);
            return msg;
        }),
    },

    Mutation: {
        sendMessage: withUser(async (ctx, args, uid) => {
            let cid = IDs.Conversation.parse(args.chatId);

            let spans: MessageSpan[] = [];

            //
            // Mentions
            //
            if (args.mentions) {
                let mentions: MessageSpan[] = [];

                for (let mention of args.mentions) {
                    if (mention.userId) {
                        mentions.push({
                            type: 'user_mention',
                            offset: mention.offset,
                            length: mention.length,
                            user: IDs.User.parse(mention.userId!)
                        });
                    } else if (mention.chatId) {
                        mentions.push({
                            type: 'room_mention',
                            offset: mention.offset,
                            length: mention.length,
                            room: IDs.Conversation.parse(mention.chatId!)
                        });
                    } else if (mention.userIds) {
                        mentions.push({
                            type: 'multi_user_mention',
                            offset: mention.offset,
                            length: mention.length,
                            users: mention.userIds.map(id => IDs.User.parse(id))
                        });
                    } else if (mention.all) {
                        mentions.push({
                            type: 'all_mention',
                            offset: mention.offset,
                            length: mention.length,
                        });
                    }
                }

                spans.push(...mentions);
            }

            //
            //  Spans
            //
            if (args.spans) {
                for (let span of args.spans) {
                    if (span.type === 'Bold') {
                        spans.push({ offset: span.offset, length: span.length, type: 'bold_text' });
                    } else if (span.type === 'Italic') {
                        spans.push({ offset: span.offset, length: span.length, type: 'italic_text' });
                    } else if (span.type === 'InlineCode') {
                        spans.push({ offset: span.offset, length: span.length, type: 'inline_code_text' });
                    } else if (span.type === 'CodeBlock') {
                        spans.push({ offset: span.offset, length: span.length, type: 'code_block_text' });
                    } else if (span.type === 'Irony') {
                        spans.push({ offset: span.offset, length: span.length, type: 'irony_text' });
                    } else if (span.type === 'Insane') {
                        spans.push({ offset: span.offset, length: span.length, type: 'insane_text' });
                    } else if (span.type === 'Loud') {
                        spans.push({ offset: span.offset, length: span.length, type: 'loud_text' });
                    } else if (span.type === 'Rotating') {
                        spans.push({ offset: span.offset, length: span.length, type: 'rotating_text' });
                    }
                }
            }

            //
            // File attachments
            //
            let attachments: MessageAttachmentInput[] = [];
            if (args.fileAttachments) {
                for (let fileInput of args.fileAttachments) {
                    let fileMetadata = await Modules.Media.saveFile(ctx, fileInput.fileId);
                    let filePreview: string | null = null;

                    if (fileMetadata.isImage) {
                        filePreview = await Modules.Media.fetchLowResPreview(ctx, fileInput.fileId);
                    }

                    attachments.push({
                        type: 'file_attachment',
                        fileId: fileInput.fileId,
                        fileMetadata: fileMetadata || null,
                        filePreview: filePreview || null
                    });
                }
            }

            //
            // Reply messages
            //
            let replyMessages = args.replyMessages && args.replyMessages.map(id => IDs.ConversationMessage.parse(id));

            // Send message
            await Modules.Messaging.sendMessage(ctx, cid, uid!, {
                message: args.message,
                repeatKey: args.repeatKey,
                attachments,
                replyMessages,
                spans
            });

            return true;
        }),
        sendSticker: withUser(async (ctx, args, uid) => {
            let cid = IDs.Conversation.parse(args.chatId);
            let sid = IDs.Sticker.parse(args.stickerId);

            let spans: MessageSpan[] = [];

            //
            // Reply messages
            //
            let replyMessages = args.replyMessages && args.replyMessages.map(id => IDs.ConversationMessage.parse(id));

            // Send message
            await Modules.Messaging.sendMessage(ctx, cid, uid!, {
                message: null,
                repeatKey: args.repeatKey,
                attachments: [],
                replyMessages,
                spans,
                stickerId: sid
            });

            return true;
        }),
        editMessage: withUser(async (ctx, args, uid) => {
            let mid = IDs.ConversationMessage.parse(args.messageId);

            let spans: MessageSpan[] = [];

            //
            // Mentions
            //
            if (args.mentions) {
                let mentions: MessageSpan[] = [];

                for (let mention of args.mentions) {
                    if (mention.userId) {
                        mentions.push({
                            type: 'user_mention',
                            offset: mention.offset,
                            length: mention.length,
                            user: IDs.User.parse(mention.userId!)
                        });
                    } else if (mention.chatId) {
                        mentions.push({
                            type: 'room_mention',
                            offset: mention.offset,
                            length: mention.length,
                            room: IDs.Conversation.parse(mention.chatId!)
                        });
                    } else if (mention.userIds) {
                        mentions.push({
                            type: 'multi_user_mention',
                            offset: mention.offset,
                            length: mention.length,
                            users: mention.userIds.map(id => IDs.User.parse(id))
                        });
                    } else if (mention.all) {
                        mentions.push({
                            type: 'all_mention',
                            offset: mention.offset,
                            length: mention.length,
                        });
                    }
                }

                spans.push(...mentions);
            }

            //
            //  Spans
            //
            if (args.spans) {
                for (let span of args.spans) {
                    if (span.type === 'Bold') {
                        spans.push({ offset: span.offset, length: span.length, type: 'bold_text' });
                    } else if (span.type === 'Italic') {
                        spans.push({ offset: span.offset, length: span.length, type: 'italic_text' });
                    } else if (span.type === 'InlineCode') {
                        spans.push({ offset: span.offset, length: span.length, type: 'inline_code_text' });
                    } else if (span.type === 'CodeBlock') {
                        spans.push({ offset: span.offset, length: span.length, type: 'code_block_text' });
                    } else if (span.type === 'Irony') {
                        spans.push({ offset: span.offset, length: span.length, type: 'irony_text' });
                    } else if (span.type === 'Insane') {
                        spans.push({ offset: span.offset, length: span.length, type: 'insane_text' });
                    } else if (span.type === 'Loud') {
                        spans.push({ offset: span.offset, length: span.length, type: 'loud_text' });
                    } else if (span.type === 'Rotating') {
                        spans.push({ offset: span.offset, length: span.length, type: 'rotating_text' });
                    }
                }
            }

            //
            // File attachments
            //
            let attachments: MessageAttachmentInput[] = [];
            if (args.fileAttachments) {
                for (let fileInput of args.fileAttachments) {
                    let fileMetadata = await Modules.Media.saveFile(ctx, fileInput.fileId);
                    let filePreview: string | null = null;

                    if (fileMetadata.isImage) {
                        filePreview = await Modules.Media.fetchLowResPreview(ctx, fileInput.fileId);
                    }

                    attachments.push({
                        type: 'file_attachment',
                        fileId: fileInput.fileId,
                        fileMetadata: fileMetadata || null,
                        filePreview: filePreview || null
                    });
                }
            }

            //
            // Reply messages
            //
            let replyMessages = args.replyMessages && args.replyMessages.map(id => IDs.ConversationMessage.parse(id));

            // Edit message
            await Modules.Messaging.editMessage(ctx, mid, uid, {
                message: args.message,
                attachments,
                replyMessages,
                spans
            }, true);

            return true;
        }),

        pinMessage: withUser(async (ctx, args, uid) => {
            let cid = IDs.Conversation.parse(args.chatId);
            let mid = IDs.ConversationMessage.parse(args.messageId);
            return await Modules.Messaging.room.pinMessage(ctx, cid, uid, mid);
        }),
        unpinMessage: withUser(async (ctx, args, uid) => {
            let cid = IDs.Conversation.parse(args.chatId);
            return await Modules.Messaging.room.unpinMessage(ctx, cid, uid);
        }),

        betaPinMessage: withUser(async (ctx, args, uid) => {
            let cid = IDs.Conversation.parse(args.chatId);
            let mid = IDs.ConversationMessage.parse(args.messageId);

            await Modules.Messaging.room.pinMessage(ctx, cid, uid, mid);

            return cid;
        }),
        betaUnpinMessage: withUser(async (ctx, args, uid) => {
            let cid = IDs.Conversation.parse(args.chatId);

            await Modules.Messaging.room.unpinMessage(ctx, cid, uid);

            return cid;
        }),
        gammaPinMessage: withUser(async (ctx, args, uid) => {
            let cid = IDs.Conversation.parse(args.chatId);
            let mid = IDs.ConversationMessage.parse(args.messageId);

            await Modules.Messaging.room.pinMessage(ctx, cid, uid, mid);

            return cid;
        }),
        gammaUnpinMessage: withUser(async (ctx, args, uid) => {
            let cid = IDs.Conversation.parse(args.chatId);

            await Modules.Messaging.room.unpinMessage(ctx, cid, uid);

            return cid;
        }),

        messageReactionAdd: withUser(async (ctx, args, uid) => {
            await Modules.Messaging.setReaction(ctx, IDs.ConversationMessage.parse(args.messageId), uid, args.reaction);
            return true;
        }),
        messageReactionRemove: withUser(async (ctx, args, uid) => {
            await Modules.Messaging.setReaction(ctx, IDs.ConversationMessage.parse(args.messageId), uid, args.reaction, true);
            return true;
        }),

        deleteChat: withUser(async (ctx, args, uid) => {
            let cid = IDs.Conversation.parse(args.chatId);
            await Modules.Messaging.room.deleteRoom(ctx, cid, uid);
            return true;
        }),
        archiveChat: withUser(async (ctx, args, uid) => {
            let cid = IDs.Conversation.parse(args.chatId);
            await Modules.Messaging.room.archiveRoom(ctx, cid, uid);
            return true;
        }),
    }
} as GQLResolver;