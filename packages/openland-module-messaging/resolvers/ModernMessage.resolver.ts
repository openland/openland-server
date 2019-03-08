import { GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
import { withUser } from '../../openland-module-api/Resolvers';
import { IDs } from '../../openland-module-api/IDs';
import { Modules } from '../../openland-modules/Modules';
import { Message } from '../../openland-module-db/schema';
import { FDB } from '../../openland-module-db/FDB';
import { createEmptyContext } from '../../openland-utils/Context';
import { GQLRoots } from '../../openland-module-api/schema/SchemaRoots';
import MessageSpanRoot = GQLRoots.MessageSpanRoot;
import { UserError } from '../../openland-errors/UserError';
import ModernMessageAttachmentRoot = GQLRoots.ModernMessageAttachmentRoot;
import { buildBaseImageUrl, ImageRef } from '../../openland-module-media/ImageRef';
import { FileInfo } from '../../openland-module-media/FileInfo';
import linkify from 'linkify-it';
import tlds from 'tlds';

const REACTIONS_LEGACY = new Map([
    ['❤️', 'LIKE'],
    ['👍', 'THUMB_UP'],
    ['😂', 'JOY'],
    ['😱', 'SCREAM'],
    ['😢', 'CRYING'],
    ['🤬', 'ANGRY'],
]);

type IntermediateMention = { type: 'user', user: number } | { type: 'room', room: number };
// Legacy user mentions
function prepareLegacyMentions(mentions: number[]): IntermediateMention[] {
    let res: IntermediateMention[] = [];

    for (let m of mentions) {
        res.push({ type: 'user', user: m });
    }

    return res;
}
// Legacy complex mentions
function prepareLegacyComplexMentions(mentions: { type: 'User'|'SharedRoom', id: number }[]): IntermediateMention[] {
    let res: IntermediateMention[] = [];

    for (let m of mentions) {
        if (m.type === 'User') {
            res.push({ type: 'user', user: m.id });
        } else if (m.type === 'SharedRoom') {
            res.push({ type: 'room', room: m.id });
        } else {
            throw new Error('Unknown mention type: ' + m.type);
        }
    }

    return res;
}

export type UserMentionSpan = { type: 'user_mention', offset: number, length: number, user: number };
export type MultiUserMentionSpan = { type: 'user_mention', offset: number, length: number, users: number[] };
export type RoomMentionSpan = { type: 'room_mention', offset: number, length: number, room: number };
export type LinkSpan = { type: 'link', offset: number, length: number, url: string };
export type MessageSpan = UserMentionSpan | RoomMentionSpan | LinkSpan;
async function mentionsToSpans(messageText: string, mentions: IntermediateMention[], uid: number): Promise<MessageSpan[]> {
    let ctx = createEmptyContext();

    if (messageText.length === 0) {
        return [];
    }

    let spans: MessageSpan[] = [];

    let offsets = new Set<number>();

    function getOffset(str: string, n: number = 0): number {
        let offset = messageText.indexOf(str, n);

        if (offsets.has(offset)) {
            return getOffset(str, n + 1);
        }

        offsets.add(offset);
        return offset;
    }

    for (let mention of mentions) {
        if (mention.type === 'user') {
            let profile = await Modules.Users.profileById(ctx, mention.user);
            let userName = [profile!.firstName, profile!.lastName].filter((v) => !!v).join(' ');
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
export type MessageRichAttachment = { type: 'rich_attachment', title?: string, subTitle?: string, titleLink?: string, text?: string, icon?: ImageRef, image?: ImageRef, iconInfo?: FileInfo, imageInfo?: FileInfo, id: string };
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
        url: url.url
    } as LinkSpan));
}

export default {
    BaseMessage: {
      __resolveType(src: Message) {
          if (src.isService) {
              return 'ServiceMessage';
          } else {
              return 'ModernMessage';
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
            if (src.mentions) {
                spans.push(...await mentionsToSpans(src.text || '', prepareLegacyMentions(src.mentions), uid));
            }
            if (src.complexMentions) {
                spans.push(...await mentionsToSpans(src.text || '', prepareLegacyComplexMentions(src.complexMentions), uid));
            }

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
    ModernMessage: {
        //
        //  State
        //
        id: src => IDs.ConversationMessage.serialize(src.id),
        date: src => src.createdAt,
        sender: src => src.uid,
        edited: src => src.edited,
        reactions: src => src.reactions || [],

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
            if (src.mentions) {
                spans.push(...await mentionsToSpans(src.text || '', prepareLegacyMentions(src.mentions), uid));
            }
            if (src.complexMentions) {
                spans.push(...await mentionsToSpans(src.text || '', prepareLegacyComplexMentions(src.complexMentions), uid));
            }

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
                    id: 'legacy_file'
                });
            }
            if (src.augmentation) {
                attachments.push({
                    type: 'rich_attachment',
                    title: src.augmentation.title,
                    titleLink: src.augmentation.url,
                    subTitle: src.augmentation.subtitle,
                    text: src.augmentation.description,
                    icon: src.augmentation.iconRef || undefined,
                    iconInfo: src.augmentation.iconInfo || undefined,
                    image: src.augmentation.photo || undefined,
                    imageInfo: src.augmentation.imageInfo || undefined,
                    id: 'legacy_rich'
                });
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
                return null;
            }
            return null;
        },
        fallback: src => 'unsupported message'
    },

    ModernMessageReaction: {
        user: src => src.userId,
        reaction: src => {
            if (REACTIONS_LEGACY.has(src.reaction)) {
                return REACTIONS_LEGACY.get(src.reaction);
            }

            return src.reaction;
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
        url: src => src.url
    },

    //
    //  Attachments
    //
    Image: {
        url: src => buildBaseImageUrl({ uuid: src.uuid, crop: null }),
        metadata: src => src.metadata
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
        id: src => src.id,
        fileId: src => src.fileId,
        fileMetadata: src => src.fileMetadata,
        filePreview: src => src.filePreview,
        fallback: src => 'File attachment'
    },
    MessageRichAttachment: {
        id: src => src.id,
        title: src => src.title,
        subTitle: src => src.subTitle,
        titleLink: src => src.titleLink,
        text: src => src.text,
        icon: src => src.icon && { uuid: src.icon.uuid, metadata: src.iconInfo },
        image: src => src.image && { uuid: src.image.uuid, metadata: src.imageInfo },
        fallback: src => src.title ? src.title : src.text ? src.text : src.titleLink ? src.titleLink : 'unsupported',
        keyboard: src => null
    },

    Query: {
        messages: withUser(async (ctx, args, uid) => {
            let roomId = IDs.Conversation.parse(args.chatId);
            let beforeId = args.before ? IDs.ConversationMessage.parse(args.before) : null;
            await Modules.Messaging.room.checkAccess(ctx, uid, roomId);

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
                        return { type: 'user_mention', offset: m.offset, length: m.length, user: IDs.User.parse(m.userId!) };
                    } else if (m.chatId) {
                        return { type: 'room_mention', offset: m.offset, length: m.length, room: IDs.Conversation.parse(m.chatId!) };
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
    }
} as GQLResolver;