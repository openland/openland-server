import { GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
import { withUser } from '../../openland-module-api/Resolvers';
import { IDs } from '../../openland-module-api/IDs';
import { Modules } from '../../openland-modules/Modules';
import { Comment, Message } from '../../openland-module-db/schema';
import { FDB } from '../../openland-module-db/FDB';
import { Context } from '../../openland-utils/Context';
import { GQLRoots } from '../../openland-module-api/schema/SchemaRoots';
import MessageSpanRoot = GQLRoots.MessageSpanRoot;
import { UserError } from '../../openland-errors/UserError';
import ModernMessageAttachmentRoot = GQLRoots.ModernMessageAttachmentRoot;
import { buildBaseImageUrl } from '../../openland-module-media/ImageRef';
import linkify from 'linkify-it';
import tlds from 'tlds';
import { LinkSpan, MessageAttachment, MessageAttachmentInput, MessageSpan } from '../MessageInput';
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

const linkifyInstance = linkify()
    .tlds(tlds)
    .tlds('onion', true);

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

export default {
    ModernMessage: {
      __resolveType(src: Message | Comment) {
          if (src instanceof Comment) {
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
        id: src => src instanceof Comment ? IDs.Comment.serialize(src.id) : IDs.ConversationMessage.serialize(src.id),
        date: src => src.createdAt,
        sender: src => src.uid,
        edited: src => src.edited || false,
        reactions: src => src instanceof Comment ? [] : src.reactions || [],

        //
        //  Content
        //
        message: src => {
            if (src instanceof Message && src.type && src.type === 'POST') {
                return null;
            }
            return src.text;
        },
        spans: async (src, args, ctx) => {
            if (src instanceof Comment) {
                return [];
            }
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
            if (src instanceof Comment) {
                return [];
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
                    augmentation = await urlInfoService.fetchURLInfo(augmentation.url, false);
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
                        imageInfo: augmentation.imageInfo || null,
                        keyboard: augmentation.keyboard || null,
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
                        imageInfo: null,
                        keyboard: null,
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
            if (src instanceof Comment) {
                return [];
            }
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
        commentsCount: async (src, argx, ctx) => {
            if (src instanceof Comment) {
                return 0;
            }

            return await Modules.Comments.getMessageCommentsCount(ctx, src.id);
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
            } else if (src.type === 'bold_text') {
                return 'MessageSpanBold';
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
        icon: src => src.attachment.icon && { uuid: src.attachment.icon.uuid, metadata: src.attachment.iconInfo },
        image: src => src.attachment.image && { uuid: src.attachment.image.uuid, metadata: src.attachment.imageInfo },
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
            if (args.before && await FDB.Message.findById(ctx, beforeId!)) {
                return await FDB.Message.rangeFromChatAfter(ctx, roomId, beforeId!, args.first!, true);
            }
            return await FDB.Message.rangeFromChat(ctx, roomId, args.first!, true);
        }),
        message: withUser(async (ctx, args, uid) => {
            let messageId = IDs.ConversationMessage.parse(args.messageId);
            let msg = await FDB.Message.findById(ctx, messageId);
            if (!msg) {
                return null;
            }

            await Modules.Messaging.room.checkAccess(ctx, uid, msg.cid);

            return msg;
        })
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
                    }
                }

                spans.push(...mentions);
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
                    }
                }

                spans.push(...mentions);
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

        messageReactionAdd: withUser(async (ctx, args, uid) => {
            await Modules.Messaging.setReaction(ctx, IDs.ConversationMessage.parse(args.messageId), uid, args.reaction);
            return true;
        }),
        messageReactionRemove: withUser(async (ctx, args, uid) => {
            await Modules.Messaging.setReaction(ctx, IDs.ConversationMessage.parse(args.messageId), uid, args.reaction, true);
            return true;
        }),
    }
} as GQLResolver;