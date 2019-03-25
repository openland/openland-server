import { GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
import { withUser } from '../../openland-module-api/Resolvers';
import { IDs } from '../../openland-module-api/IDs';
import { Modules } from '../../openland-modules/Modules';
import { Message } from '../../openland-module-db/schema';
import { FDB } from '../../openland-module-db/FDB';
import { Context } from '../../openland-utils/Context';
import { GQLRoots } from '../../openland-module-api/schema/SchemaRoots';
import MessageSpanRoot = GQLRoots.MessageSpanRoot;
import { UserError } from '../../openland-errors/UserError';
import ModernMessageAttachmentRoot = GQLRoots.ModernMessageAttachmentRoot;
import { buildBaseImageUrl, ImageRef } from '../../openland-module-media/ImageRef';
import { FileInfo } from '../../openland-module-media/FileInfo';
import linkify from 'linkify-it';
import tlds from 'tlds';
import { MessageKeyboard } from '../MessageInput';
import { createUrlInfoService, URLAugmentation } from '../workers/UrlInfoService';

const REACTIONS_LEGACY = new Map([
    ['❤️', 'LIKE'],
    ['👍', 'THUMB_UP'],
    ['😂', 'JOY'],
    ['😱', 'SCREAM'],
    ['😢', 'CRYING'],
    ['🤬', 'ANGRY'],
]);

type IntermediateMention = { type: 'user', user: number } | { type: 'room', room: number };
export type UserMentionSpan = { type: 'user_mention', offset: number, length: number, user: number };
export type MultiUserMentionSpan = { type: 'multi_user_mention', offset: number, length: number, users: number[] };
export type RoomMentionSpan = { type: 'room_mention', offset: number, length: number, room: number };
export type LinkSpan = { type: 'link', offset: number, length: number, url: string };
export type MessageSpan = UserMentionSpan | MultiUserMentionSpan | RoomMentionSpan | LinkSpan;

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

export type MessageAttachmentFile = { type: 'file_attachment', fileId: string, filePreview?: string, fileMetadata?: any, id: string };
export type MessageRichAttachment = {
    type: 'rich_attachment',
    title?: string,
    subTitle?: string,
    titleLink?: string,
    text?: string,
    icon?: ImageRef,
    image?: ImageRef,
    iconInfo?: FileInfo,
    imageInfo?: FileInfo,
    titleLinkHostname?: string,
    id: string,
    keyboard?: MessageKeyboard
};

export type MessageAttachment = MessageAttachmentFile | MessageRichAttachment;

const linkifyInstance = linkify()
    .tlds(tlds)
    .tlds('onion', true);

function parseLinks(message: string): MessageSpan[] {
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
        text: url.text
    } as LinkSpan));
}

const urlInfoService = createUrlInfoService();

export default {
    ModernMessage: {
      __resolveType(src: Message) {
          if (src.isService) {
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
        id: src => IDs.ConversationMessage.serialize(src.id),
        date: src => src.createdAt,
        sender: src => src.uid,

        //
        //  Content
        //
        message: src => src.text,
        spans: async (src, args, ctx) => {
            //
            //  Modern spans
            //
            if (src.spans) {
                return src.spans;
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
        fallback: src => 'unsupported message'
    },
    GeneralMessage: {
        //
        //  State
        //
        id: src => IDs.ConversationMessage.serialize(src.id),
        date: src => src.createdAt,
        sender: src => src.uid,
        edited: src => src.edited || false,
        reactions: src => src.reactions || [],

        //
        //  Content
        //
        message: src => {
            if (src.type && src.type === 'POST') {
                return null;
            }
            return src.text;
        },
        spans: async (src, args, ctx) => {
            //
            //  Modern spans
            //
            if (src.spans) {
                return src.spans;
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
            let attachments: MessageAttachment[] = [];

            if (src.fileId) {
                attachments.push({
                    type: 'file_attachment',
                    fileId: src.fileId,
                    filePreview: src.filePreview || undefined,
                    fileMetadata: src.fileMetadata,
                    id: src.id + '_legacy_file'
                });
            }
            if (src.augmentation) {
                let augmentation: URLAugmentation = src.augmentation;
                if (augmentation.dynamic) {
                    augmentation = await urlInfoService.fetchURLInfo(augmentation.url, false);
                }

                attachments.push({
                    type: 'rich_attachment',
                    title: augmentation.title || undefined,
                    titleLink: augmentation.url,
                    titleLinkHostname: augmentation.hostname || undefined,
                    subTitle: augmentation.subtitle || undefined,
                    text: augmentation.description || undefined,
                    icon: augmentation.iconRef || undefined,
                    iconInfo: augmentation.iconInfo || undefined,
                    image: augmentation.photo || undefined,
                    imageInfo: augmentation.imageInfo || undefined,
                    keyboard: augmentation.keyboard || undefined,
                    id: src.id + '_legacy_rich'
                });
            }
            if (src.type && src.type === 'POST') {
                attachments.push({
                    type: 'rich_attachment',
                    title: src.title || '',
                    titleLink: undefined,
                    subTitle: undefined,
                    text: src.text || '',
                    icon: undefined,
                    iconInfo: undefined,
                    image: undefined,
                    imageInfo: undefined,
                    id: src.id + '_legacy_post'
                });
            }
            if (src.attachments) {
                let i = 0;
                for (let attachment of src.attachments) {
                    attachments.push({
                        type: 'file_attachment',
                        fileId: attachment.fileId,
                        filePreview: attachment.filePreview || undefined,
                        fileMetadata: attachment.fileMetadata,
                        id: src.id + '_legacy_file_' + i
                    });
                    i++;
                }
            }

            return attachments;
        },
        quotedMessages: async (src, args, ctx) => {
            if (src.replyMessages) {
                let messages = await Promise.all((src.replyMessages as number[]).map(id => FDB.Message.findById(ctx, id)));
                let filtered = messages.filter(m => !!m);
                if (filtered.length > 0) {
                    return filtered;
                }
                return [];
            }
            return [];
        },
        fallback: src => 'unsupported message'
    },

    ModernMessageReaction: {
        user: src => src.userId,
        reaction: src => {
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

    //
    //  Attachments
    //
    Image: {
        url: src => buildBaseImageUrl({ uuid: src.uuid, crop: null }),
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
        }
    },
    ModernMessageAttachment: {
        __resolveType(src: ModernMessageAttachmentRoot) {
            if (src.type === 'file_attachment') {
                return 'MessageAttachmentFile';
            } else if (src.type === 'rich_attachment') {
                return 'MessageRichAttachment';
            } else {
                throw new UserError('Unknown message attachment type: ' + (src as any).type);
            }
        }
    },
    MessageAttachmentFile: {
        id: src => IDs.MessageAttachment.serialize(src.id),
        fileId: src => src.fileId,
        fileMetadata: src => {
            if (src.fileId && src.fileMetadata) {
                return {
                    name: src.fileMetadata.name,
                    mimeType: src.fileMetadata.mimeType,
                    isImage: !!(src.fileMetadata.isImage),
                    imageWidth: src.fileMetadata.imageWidth,
                    imageHeight: src.fileMetadata.imageHeight,
                    imageFormat: src.fileMetadata.imageFormat,
                    size: src.fileMetadata.size
                };
            } else {
                return null;
            }
        },
        filePreview: src => src.filePreview,
        fallback: src => 'File attachment'
    },
    MessageRichAttachment: {
        id: src => IDs.MessageAttachment.serialize(src.id),
        title: src => src.title,
        subTitle: src => src.subTitle,
        titleLink: src => src.titleLink,
        titleLinkHostname: src => src.titleLinkHostname,
        text: src => src.text,
        icon: src => src.icon && { uuid: src.icon.uuid, metadata: src.iconInfo },
        image: src => src.image && { uuid: src.image.uuid, metadata: src.imageInfo },
        fallback: src => src.title ? src.title : src.text ? src.text : src.titleLink ? src.titleLink : 'unsupported',
        keyboard: src => src.keyboard
    },

    Query: {
        messages: withUser(async (ctx, args, uid) => {
            let roomId = IDs.Conversation.parse(args.chatId);
            let beforeId = args.before ? IDs.ConversationMessage.parse(args.before) : null;
            await Modules.Messaging.room.checkAccess(ctx, uid, roomId);
            if (!args.first || args.first <= 0) {
                return [];
            }
            if (args.before && await FDB.Message.findById(ctx, beforeId!)) {
                return await FDB.Message.rangeFromChatAfter(ctx, roomId, beforeId!, args.first!, true);
            }
            return await FDB.Message.rangeFromChat(ctx, roomId, args.first!, true);
        }),
    },

    Mutation: {
        sendMessage: withUser(async (ctx, args, uid) => {
            let cid = IDs.Conversation.parse(args.chatId);

            let spans: MessageSpan[] = [];
            spans.push(...parseLinks(args.message || ''));

            if (args.mentions) {
                let mentions = args.mentions.map(m => {
                    if (m.userId) {
                        return {
                            type: 'user_mention',
                            offset: m.offset,
                            length: m.length,
                            user: IDs.User.parse(m.userId!)
                        };
                    } else if (m.chatId) {
                        return {
                            type: 'room_mention',
                            offset: m.offset,
                            length: m.length,
                            room: IDs.Conversation.parse(m.chatId!)
                        };
                    } else {
                        return null;
                    }
                }).filter(m => !!m);
                spans.push(...mentions as MessageSpan[]);
            }

            // Send message
            await Modules.Messaging.sendMessage(ctx, cid, uid!, {
                message: args.message,
                repeatKey: args.repeatKey,
                spans
            });

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
        })
    }
} as GQLResolver;