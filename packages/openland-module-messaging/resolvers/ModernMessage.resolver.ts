import {
    Organization, RichMessage, UserBadge, UserProfile, ConversationRoom, FeedEvent, PrivateMessage,
} from 'openland-module-db/store';
import { GQL, GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
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
import {
    ItalicTextSpan,
    LinkSpan,
    MessageAttachment, MessageAttachmentFileInput,
    MessageAttachmentInput,
    MessageButton,
    MessageSpan,
    UserMentionSpan,
} from '../MessageInput';
import { createUrlInfoService, URLAugmentation } from '../workers/UrlInfoService';
import { Texts } from '../texts';
import { createLinkifyInstance } from '../../openland-utils/createLinkifyInstance';
import { MessageMention } from '../MessageInput';
import { Store } from 'openland-module-db/FDB';
import MessageSourceRoot = GQLRoots.MessageSourceRoot;
import MentionPeerRoot = GQLRoots.MentionPeerRoot;
import MessageWithMentionRoot = GQLRoots.MessageWithMentionRoot;
import ModernMessageRoot = GQLRoots.ModernMessageRoot;
import { NotFoundError } from '../../openland-errors/NotFoundError';
import { isDefined } from '../../openland-utils/misc';
import MessageReactionTypeRoot = GQLRoots.MessageReactionTypeRoot;
import MentionInput = GQL.MentionInput;
import GeneralMessageRoot = GQLRoots.GeneralMessageRoot;
import { plural } from '../../openland-utils/string';
import { FileInfo } from '../../openland-module-media/FileInfo';

export function hasMention(message: Message | PrivateMessage | RichMessage, uid: number) {
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

export function getAllMentions(message: Message | PrivateMessage | RichMessage) {
    let mentions: number[] = [];
    if (message.spans) {
        for (let s of message.spans) {
            if (s.type === 'user_mention') {
                mentions.push(s.user);
            } else if (s.type === 'multi_user_mention') {
                for (let u of s.users) {
                    mentions.push(u);
                }
            }
        }
    }
    return mentions;
}

export function hasAllMention(message: Message | PrivateMessage | RichMessage) {
    if (message.spans && message.spans.find(s => s.type === 'all_mention')) {
        return true;
    }
    return false;
}

export function convertMentionsToSpans(mentions: MentionInput[]) {
    let spans: MessageSpan[] = [];

    for (let mention of mentions) {
        if (mention.userId) {
            spans.push({
                type: 'user_mention',
                offset: mention.offset,
                length: mention.length,
                user: IDs.User.parse(mention.userId!),
            });
        } else if (mention.chatId) {
            spans.push({
                type: 'room_mention',
                offset: mention.offset,
                length: mention.length,
                room: IDs.Conversation.parse(mention.chatId!),
            });
        } else if (mention.userIds) {
            spans.push({
                type: 'multi_user_mention',
                offset: mention.offset,
                length: mention.length,
                users: mention.userIds.map(id => IDs.User.parse(id)),
            });
        } else if (mention.all) {
            spans.push({
                type: 'all_mention',
                offset: mention.offset,
                length: mention.length,
            });
        } else if (mention.orgId) {
            spans.push({
                type: 'organization_mention',
                offset: mention.offset,
                length: mention.length,
                organization: IDs.Organization.parse(mention.orgId),
            });
        }
    }
    return spans;
}

export const REACTIONS_LEGACY = new Map([
    ['❤️', 'LIKE'],
    ['👍', 'THUMB_UP'],
    ['😂', 'JOY'],
    ['😱', 'SCREAM'],
    ['😢', 'CRYING'],
    ['🤬', 'ANGRY'],
]);

export const REACTIONS = ['LIKE', 'THUMB_UP', 'JOY', 'SCREAM', 'CRYING', 'ANGRY', 'DONATE'];
const DELETED_TEXT = {
    MESSAGE: 'This message has been deleted',
    COMMENT: 'This comment has been deleted',
};

const getDeletedText = (src: Message | PrivateMessage | Comment | RichMessage) => src instanceof Comment ? DELETED_TEXT.COMMENT : DELETED_TEXT.MESSAGE;

// type IntermediateMention = { type: 'user', user: number } | { type: 'room', room: number };

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
                    user: mention,
                });
            }
        }
    }

    return spans;
}

function isMessageHiddenForUser(message: Message | PrivateMessage | Comment | RichMessage, forUid: number) {
    if (!(message instanceof Message)) {
        return false;
    }
    if (message.visibleOnlyForUids && message.visibleOnlyForUids.length > 0 && !message.visibleOnlyForUids.includes(forUid)) {
        return true;
    }
    return false;
}

// async function prepareLegacyMentions(ctx: Context, message: Message, uid: number): Promise<MessageSpan[]> {
//     let messageText = message.text || '';

//     if (messageText.length === 0) {
//         return [];
//     }

//     let intermediateMentions: IntermediateMention[] = [];
//     let spans: MessageSpan[] = [];

//     //
//     //  Legacy user mentions
//     //
//     if (message.mentions) {
//         for (let m of message.mentions) {
//             intermediateMentions.push({ type: 'user', user: m });
//         }
//     }

//     //
//     // Legacy complex mentions
//     //
//     if (message.complexMentions) {
//         for (let m of message.complexMentions) {
//             if (m.type === 'User') {
//                 intermediateMentions.push({ type: 'user', user: m.id });
//             } else if (m.type === 'SharedRoom') {
//                 intermediateMentions.push({ type: 'room', room: m.id });
//             } else {
//                 throw new Error('Unknown mention type: ' + m.type);
//             }
//         }
//     }

//     //
//     // Multi-user join service message
//     //
//     let multiUserJoinRegexp = /along with (\d?) others/;
//     if (message.isService && message.serviceMetadata && message.serviceMetadata.type === 'user_invite' && multiUserJoinRegexp.test(messageText)) {
//         let [, _usersJoined] = multiUserJoinRegexp.exec(messageText)!;
//         let usersJoined = parseInt(_usersJoined, 10);
//         let othersText = usersJoined + ' others';
//         let othersMentions = intermediateMentions.splice(-usersJoined);
//         spans.push({
//             type: 'multi_user_mention',
//             offset: messageText.length - othersText.length,
//             length: othersText.length,
//             users: othersMentions.map((v: any) => v.user),
//         });
//     }
//     let offsets = new Set<number>();

//     function getOffset(str: string, n: number = 0): number {
//         let offset = messageText.indexOf(str, n);
//         if (offset === -1) {
//             return -1;
//         }

//         if (offsets.has(offset)) {
//             return getOffset(str, n + 1);
//         }

//         offsets.add(offset);
//         return offset;
//     }

//     //
//     //  Kick service message
//     //
//     if (message.isService && message.serviceMetadata && message.serviceMetadata.type === 'user_kick' && !message.complexMentions) {
//         let userName = await Modules.Users.getUserFullName(ctx, message.serviceMetadata.userId);
//         let kickerUserName = await Modules.Users.getUserFullName(ctx, message.serviceMetadata.kickedById);

//         let index1 = getOffset(userName);
//         if (index1 > -1) {
//             spans.push({
//                 type: 'user_mention',
//                 offset: index1,
//                 length: userName.length,
//                 user: message.serviceMetadata.userId,
//             });
//         }
//         let index2 = getOffset(kickerUserName);
//         if (index2 > -1) {
//             spans.push({
//                 type: 'user_mention',
//                 offset: index2,
//                 length: kickerUserName.length,
//                 user: message.serviceMetadata.kickedById,
//             });
//         }
//     }

//     for (let mention of intermediateMentions) {
//         if (mention.type === 'user') {
//             let userName = await Modules.Users.getUserFullName(ctx, mention.user);
//             let mentionText = '@' + userName;

//             let index = getOffset(mentionText);

//             if (index > -1) {
//                 spans.push({
//                     type: 'user_mention',
//                     offset: index,
//                     length: mentionText.length,
//                     user: mention.user,
//                 });
//             }
//         } else if (mention.type === 'room') {
//             let roomName = await Modules.Messaging.room.resolveConversationTitle(ctx, mention.room, uid);
//             let mentionText = '@' + roomName;

//             let index = getOffset(mentionText);

//             if (index > -1) {
//                 spans.push({
//                     type: 'room_mention',
//                     offset: index,
//                     length: mentionText.length,
//                     room: mention.room,
//                 });
//             }
//         }
//     }

//     return spans;
// }

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

export function fetchMessageFallback(ctx: Context, lang: GQLRoots.LanguageRoot, message: Message | PrivateMessage | Comment | RichMessage): string {
    const attachFallback = (mime?: string | null, isImage?: boolean | null) => {
        if (!mime) {
            return Texts.Notifications.DOCUMENT_ATTACH(lang);
        } else if (mime === 'image/gif') {
            return Texts.Notifications.GIF_ATTACH(lang);
        } else if (isImage) {
            return Texts.Notifications.IMAGE_ATTACH(lang);
        } else if (mime.startsWith('video/')) {
            return Texts.Notifications.VIDEO_ATTACH(lang);
        } else {
            return Texts.Notifications.DOCUMENT_ATTACH(lang);
        }
    };

    let fallback: string[] = [];

    if (message.text) {
        fallback.push(message.text);
    }
    if ((message instanceof Message || message instanceof Comment || message instanceof PrivateMessage) && message.stickerId) {
        fallback.push(Texts.Notifications.STICKER(lang));
    }
    if ((message instanceof Message || message instanceof PrivateMessage) && message.fileMetadata) {
        fallback.push(attachFallback(message.fileMetadata && message.fileMetadata.mimeType, message.fileMetadata && message.fileMetadata.isImage));
    }
    let attachments = (message instanceof Message || message instanceof PrivateMessage) ? message.attachmentsModern : message.attachments;
    if (attachments) {
        let attachmentsByType = new Map<string, number>();
        for (let attach of attachments) {
            if (attach.type === 'file_attachment') {
                let type = attachFallback(attach.fileMetadata && attach.fileMetadata.mimeType, attach.fileMetadata && attach.fileMetadata.isImage);
                attachmentsByType.set(type, (attachmentsByType.get(type) || 0) + 1);
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
            } else if (attach.type === 'purchase_attachment') {
                fallback.push(Texts.Notifications.DONATION_ATTACH(lang));
            }
        }
        for (let [type, count] of attachmentsByType) {
            if (count === 1) {
                fallback.push(type);
            } else {
                fallback.push(`${count} ${plural(count, [type, type + 's'])}`);
            }
        }
    }

    if ((message instanceof Message || message instanceof PrivateMessage) && message.replyMessages && message.replyMessages.length > 0) {
        fallback.push(Texts.Notifications.REPLY_ATTACH(lang));
    }

    return fallback.join('\n');
}

async function getMessageSenderBadge(ctx: Context, src: Message | PrivateMessage | Comment): Promise<UserBadge | null> {
    return null;
}

function resolveReactionCounters(src: GeneralMessageRoot, args: any, ctx: Context) {
    let counts = new Map<MessageReactionTypeRoot, number>();
    let setByUser = new Set<MessageReactionTypeRoot>();

    src.reactions?.forEach(r => {
        if (REACTIONS.includes(r.reaction)) {
            counts.set(r.reaction as MessageReactionTypeRoot, (counts.get(r.reaction as MessageReactionTypeRoot) || 0) + 1);
            if (r.userId === ctx.auth.uid) {
                setByUser.add(r.reaction as MessageReactionTypeRoot);
            }
        }
    });
    return [...counts.entries()].map(e => ({ reaction: e[0], count: e[1], setByMe: setByUser.has(e[0]) }));
}

export const saveFileAttachments = async (ctx: Context, fileAttachments: GQL.FileAttachmentInput[]) => {
    let attachments: MessageAttachmentFileInput[] = [];
    for (let fileInput of fileAttachments) {
        let fileMetadata = await Modules.Media.saveFile(ctx, fileInput.fileId);
        let filePreview: string | null = null;

        if (fileMetadata.isImage) {
            filePreview = await Modules.Media.fetchLowResPreview(ctx, fileInput.fileId);
        }

        let previewFileMetadata: FileInfo | null = null;
        if (fileInput.previewFileId) {
            previewFileMetadata = await Modules.Media.saveFile(ctx, fileInput.previewFileId);
            if (!previewFileMetadata.isImage) {
                throw new Error('Preview file should be an image');
            }

            filePreview = await Modules.Media.fetchLowResPreview(ctx, fileInput.previewFileId);
        }

        attachments.push({
            type: 'file_attachment',
            fileId: fileInput.fileId,
            fileMetadata: fileMetadata || null,
            filePreview: filePreview || null,
            previewFileId: fileInput.previewFileId,
            previewFileMetadata: previewFileMetadata,
            videoMetadata: fileInput.videoMetadata,
        });
    }
    return attachments;
};

export const Resolver: GQLResolver = {
    ModernMessage: {
        __resolveType(src: ModernMessageRoot) {
            if (src instanceof RichMessage) {
                return 'GeneralMessage';
            } else if (src.stickerId) {
                return 'StickerMessage';
            } else if (src instanceof Comment) {
                return 'GeneralMessage';
            } else if (src.isService) {
                return 'ServiceMessage';
            } else {
                return 'GeneralMessage';
            }
        },
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
            } else if (src instanceof PrivateMessage) {
                return IDs.ConversationMessage.serialize(src.id);
            }
            throw new Error('unknown message ' + src);
        },
        seq: src => {
            if (src instanceof Message) {
                return src.seq;
            }
            return null;
        },
        date: src => src.metadata.createdAt,
        sender: (src, args, ctx) => {
            if (src.deleted || isMessageHiddenForUser(src, ctx.auth.uid!)) {
                const deletedUserId = Modules.Users.getDeletedUserId();
                if (deletedUserId) {
                    return deletedUserId;
                }
            }
            return src.uid;
        },
        senderBadge: (src, args, ctx) => getMessageSenderBadge(ctx, src),
        isMentioned: (src, args, ctx) => {
            if (src instanceof Message) {
                return hasMention(src, ctx.auth.uid!);
            }
            return false;
        },
        source: (src, args, ctx) => src,
        hidden: (src, args, ctx) => isMessageHiddenForUser(src, ctx.auth.uid!),

        //
        //  Content
        //
        message: (src, args, ctx) => {
            if (src.deleted || isMessageHiddenForUser(src, ctx.auth.uid!)) {
                return getDeletedText(src);
            }
            return src.text;
        },
        spans: (src, args, ctx) => {
            if (src.deleted || isMessageHiddenForUser(src, ctx.auth.uid!)) {
                return [];
            }
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
                                user: ctx.auth.uid!,
                            } as UserMentionSpan;
                        } else {
                            return span;
                        }
                    })
                    .filter(span => span.type !== 'date_text');
            }

            // let uid = ctx.auth.uid!;
            let spans: MessageSpan[] = [];

            //
            //  Legacy data support
            //
            // spans.push(...await prepareLegacyMentions(ctx, src, uid));

            //
            //  Links
            //
            spans.push(...parseLinks(src.text || ''));

            return spans;
        },
        serviceMetadata: src => {
            if (src.serviceMetadata && (src.serviceMetadata as any).type) {
                return src.serviceMetadata;
            }

            return null;
        },
        fallback: (src, _, ctx) => fetchMessageFallback(ctx, 'EN', src),
        overrideAvatar: src => src.overrideAvatar,
        overrideName: src => src.overrideName,
    },
    GeneralMessage: {
        //
        //  State
        //
        id: src => {
            if (src instanceof Comment) {
                return IDs.Comment.serialize(src.id);
            } else if (src instanceof Message || src instanceof PrivateMessage) {
                return IDs.ConversationMessage.serialize(src.id);
            } else if (src instanceof RichMessage) {
                return IDs.RichMessage.serialize(src.id);
            }
            throw new Error('unknown message ' + src);
        },
        date: src => src.metadata.createdAt,
        seq: src => {
            if (src instanceof Message) {
                return src.seq;
            }
            return null;
        },
        sender: (src, args, ctx) => {
            // message can be deleted, while sender can be alive or deleted

            if (src.deleted || isMessageHiddenForUser(src, ctx.auth.uid!)) {
                const deletedUserId = Modules.Users.getDeletedUserId();
                if (deletedUserId) {
                    return deletedUserId;
                }
            }
            return src.uid;
        },
        senderBadge: (src, args, ctx) => src instanceof RichMessage ? null : src.deleted ? null : getMessageSenderBadge(ctx, src),
        edited: src => src.edited || false,
        reactions: src => src.reactions || [],
        reactionCounters: resolveReactionCounters,
        isMentioned: (src, args, ctx) => {
            if (src instanceof Message) {
                return hasMention(src, ctx.auth.uid!);
            }
            return false;
        },
        source: (src, args, ctx) => {
            if (src instanceof RichMessage) {
                throw new NotFoundError();
            }
            return src;
        },
        hidden: (src, args, ctx) => isMessageHiddenForUser(src, ctx.auth.uid!),

        //
        //  Content
        //
        message: (src, args, ctx) => {
            if (src.deleted || isMessageHiddenForUser(src, ctx.auth.uid!)) {
                return getDeletedText(src);
            }
            if (src instanceof Message && src.type && src.type === 'POST') {
                return null;
            }
            return src.text;
        },
        spans: (src, args, ctx) => {
            if (src.deleted || isMessageHiddenForUser(src, ctx.auth.uid!)) {
                return [
                    {
                        type: 'italic_text',
                        offset: 0,
                        length: getDeletedText(src).length,
                    } as ItalicTextSpan
                ];
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
                                user: ctx.auth.uid!,
                            } as UserMentionSpan;
                        } else {
                            return span;
                        }
                    })
                    .filter(span => span.type !== 'date_text');
            } else if (src instanceof Comment || src instanceof RichMessage) {
                return [];
            }

            // let uid = ctx.auth.uid!;
            let spans: MessageSpan[] = [];

            //
            //  Legacy data support
            //
            // spans.push(...await prepareLegacyMentions(ctx, src, uid));

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

            let attachments: { attachment: MessageAttachment, message: Message | PrivateMessage }[] = [];

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
                            size: src.fileMetadata.size,
                        } : null,
                        id: src.id + '_legacy_file',
                        previewFileId: null,
                        previewFileMetadata: null,
                        videoMetadata: null
                    },
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
                        socialImage: null,
                        socialImagePreview: null,
                        socialImageInfo: null,
                        featuredIcon: false,
                        id: src.id + '_legacy_rich',
                    },
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
                        socialImage: null,
                        socialImagePreview: null,
                        socialImageInfo: null,
                        featuredIcon: false,
                        id: src.id + '_legacy_post',
                    },
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
                            id: src.id + '_legacy_file_' + i,
                            previewFileMetadata: null,
                            previewFileId: null,
                            videoMetadata: null
                        },
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
            if (src.replyMessages && src.replyMessages.length > 0) {
                let messages = await Promise.all((src.replyMessages as number[]).map(id => Store.Message.findById(ctx, id)));
                let filtered = messages.filter(isDefined);
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
        fallback: (src, _, ctx) => fetchMessageFallback(ctx, 'EN', src),
        overrideAvatar: src => src.overrideAvatar,
        overrideName: src => src.overrideName,
    },
    StickerMessage: {
        //
        //  State
        //
        id: src => {
            if (src instanceof Comment) {
                return IDs.Comment.serialize(src.id);
            } else if (src instanceof Message || src instanceof PrivateMessage) {
                return IDs.ConversationMessage.serialize(src.id);
            }
            throw new Error('unknown message ' + src);
        },
        date: src => src.metadata.createdAt,
        seq: src => {
            if (src instanceof Message) {
                return src.seq;
            }
            return null;
        },
        sender: (src, args, ctx) => {
            // message can be deleted, while sender can be alive or deleted

            if (src.deleted || isMessageHiddenForUser(src, ctx.auth.uid!)) {
                const deletedUserId = Modules.Users.getDeletedUserId();
                if (deletedUserId) {
                    return deletedUserId;
                }
            }
            return src.uid;
        },
        senderBadge: (src, args, ctx) => src.deleted ? null : getMessageSenderBadge(ctx, src),
        reactions: src => src.reactions || [],
        reactionCounters: resolveReactionCounters,
        source: (src, args, ctx) => src,
        sticker: (src) => src.stickerId!,
        hidden: (src, args, ctx) => isMessageHiddenForUser(src, ctx.auth.uid!),

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
            if (src.replyMessages && src.replyMessages.length > 0) {
                let messages = await Promise.all((src.replyMessages as number[]).map(id => Store.Message.findById(ctx, id)));
                let filtered = messages.filter(isDefined);
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
        fallback: (src, _, ctx) => fetchMessageFallback(ctx, 'EN', src),
        overrideAvatar: src => src.overrideAvatar,
        overrideName: src => src.overrideName,
    },

    //
    // Message source
    //
    MessageSource: {
        __resolveType(src: MessageSourceRoot) {
            if (src instanceof Message || src instanceof PrivateMessage) {
                return 'MessageSourceChat';
            } else if (src instanceof Comment) {
                return 'MessageSourceComment';
            }
            throw new Error('Unknown message source: ' + src);
        },
    },
    MessageSourceChat: {
        chat: src => src.cid,
    },
    MessageSourceComment: {
        peer: async (src, args, ctx) => {
            return {
                comments: (await Store.Comment.peer.findAll(ctx, src.peerType, src.peerId)).filter(c => c.visible),
                peerType: src.peerType,
                peerId: src.peerId,
            };
        },
    },

    ModernMessageReaction: {
        user: src => src.userId,
        reaction: src => {
            // modern
            if (REACTIONS.indexOf(src.reaction) > -1) {
                return src.reaction as MessageReactionTypeRoot;
            }
            // old
            if (REACTIONS_LEGACY.has(src.reaction)) {
                return REACTIONS_LEGACY.get(src.reaction) as MessageReactionTypeRoot;
            }
            return 'LIKE';
        },
    },
    ReactionCounter: {
        reaction: src => src.reaction,
        count: src => src.count
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
            } else if (src.type === 'organization_mention') {
                return 'MessageSpanOrganizationMention';
            } else if (src.type === 'hash_tag') {
                return 'MessageSpanHashTag';
            } else {
                throw new UserError('Unknown message span type: ' + (src as any).type);
            }
        },
    },
    MessageSpanUserMention: {
        offset: src => src.offset,
        length: src => src.length,
        user: src => src.user,
    },
    MessageSpanMultiUserMention: {
        offset: src => src.offset,
        length: src => src.length,
        users: src => src.users,
    },
    MessageSpanRoomMention: {
        offset: src => src.offset,
        length: src => src.length,
        room: src => src.room,
    },
    MessageSpanOrganizationMention: {
        offset: src => src.offset,
        length: src => src.length,
        organization: async (src, _, ctx) => (await Store.Organization.findById(ctx, src.organization))!,
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
        text: src => src.text,
    },
    Image: {
        url: src => buildBaseImageUrl({ uuid: src.uuid, crop: src.crop || null })!,
        metadata: src => {
            if (src.metadata) {
                return {
                    name: src.metadata.name,
                    mimeType: src.metadata.mimeType,
                    isImage: !!(src.metadata.isImage),
                    imageWidth: src.metadata.imageWidth,
                    imageHeight: src.metadata.imageHeight,
                    imageFormat: src.metadata.imageFormat,
                    size: src.metadata.size,
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
            } else if (src.attachment.type === 'purchase_attachment') {
                return 'MessageAttachmentPurchase';
            } else {
                throw new UserError('Unknown message attachment type: ' + (src as any).type);
            }
        },
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
                    size: metadata.size,
                };
            } else {
                return {
                    name: '',
                    mimeType: '',
                    isImage: false,
                    imageWidth: 0,
                    imageHeight: 0,
                    imageFormat: 0,
                    size: 0,
                };
            }
        },
        filePreview: src => src.attachment.filePreview,
        fallback: src => 'File attachment',
        previewFileId: src => src.attachment.previewFileId,
        previewFileMetadata: src => src.attachment.previewFileMetadata,
        videoMetadata: src => src.attachment.videoMetadata
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
            metadata: src.attachment.iconInfo || undefined,
            crop: src.attachment.icon.crop,
        },
        image: src => src.attachment.image && {
            uuid: src.attachment.image.uuid,
            metadata: src.attachment.imageInfo || undefined,
            crop: src.attachment.image.crop,
            fallback: src.attachment.imageFallback,
        },
        imageFallback: src => src.attachment.imageFallback,
        imagePreview: src => src.attachment.imagePreview,
        socialImage: src => src.attachment.socialImage && {
            uuid: src.attachment.socialImage.uuid,
            metadata: src.attachment.socialImageInfo || undefined,
            crop: src.attachment.socialImage.crop,
        },
        socialImagePreview: src => src.attachment.socialImagePreview,
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

            return { buttons: src.attachment.keyboard.buttons as (MessageButton & { id: string })[][] };
        },
        featuredIcon: src => src.attachment.featuredIcon || false
    },
    MessageAttachmentPurchase: {
        id: src => IDs.MessageAttachment.serialize('kek'),
        fallback: src => 'Donation attachment',
        purchase: async (src, _, ctx) => (await Store.WalletPurchase.findById(ctx, src.attachment.pid))!,
    },
    MentionPeer: {
        __resolveType(obj: MentionPeerRoot) {
            if (obj instanceof UserProfile) {
                return 'User';
            } else if (obj instanceof ConversationRoom) {
                return 'SharedRoom';
            } else if (obj instanceof Organization) {
                return 'Organization';
            }
            throw new Error('Obj type is unknown');
        },
    },
    MessageWithMention: {
        __resolveType(obj: MessageWithMentionRoot) {
            if (obj instanceof FeedEvent) {
                return 'FeedPost';
            }
            throw new Error('Obj type is unknown');
        }
    },

    Query: {
        messages: withUser(async (ctx, args, uid) => {
            let roomId = IDs.Conversation.parse(args.chatId);
            let beforeId = args.before ? IDs.ConversationMessage.parse(args.before) : null;
            if (
                !(await Modules.Messaging.room.canUserSeeChat(ctx, uid, roomId)) ||
                !args.first ||
                args.first <= 0
            ) {
                return [];
            }
            if (args.before && await Store.Message.findById(ctx, beforeId!)) {
                return (await Modules.Messaging.fetchMessages(ctx, roomId, uid, {
                    after: beforeId!,
                    limit: args.first!,
                    reverse: true
                })).items;
            }
            return (await Modules.Messaging.fetchMessages(ctx, roomId, uid, { limit: args.first!, reverse: true })).items;
        }),

        gammaMessages: withUser(async (ctx, args, uid) => {
            let roomId = IDs.Conversation.parse(args.chatId);
            if (
                !(await Modules.Messaging.room.canUserSeeChat(ctx, uid, roomId)) ||
                !args.first ||
                args.first <= 0
            ) {
                return {
                    haveMoreForward: false,
                    haveMoreBackward: false,
                    messages: [],
                };
            }

            let aroundId = args.around ? IDs.ConversationMessage.parse(args.around) : null;

            if (!aroundId && !args.before && !args.after) {
                let seq = await Modules.Messaging.messaging.userReadSeqs.getUserReadSeqForChat(ctx, uid, roomId);
                let message = await Store.Message.chatSeq.query(ctx, roomId, { after: seq, limit: 1 });
                if (message.items.length > 0) {
                    aroundId = message.items[0].id;
                }
            }

            let beforeId = aroundId || (args.before ? IDs.ConversationMessage.parse(args.before) : null);
            let afterId = aroundId || (args.after ? IDs.ConversationMessage.parse(args.after) : null);

            let haveMoreForward: boolean | undefined;
            let haveMoreBackward: boolean | undefined;
            let messages: (Message | PrivateMessage)[] = [];

            if (beforeId || afterId) {
                let before: (Message | PrivateMessage)[] = [];
                let after: (Message | PrivateMessage)[] = [];

                if (beforeId && await Store.Message.findById(ctx, beforeId)) {
                    let beforeQuery = (await Modules.Messaging.fetchMessages(ctx, roomId, uid, {
                        after: beforeId,
                        limit: args.first!,
                        reverse: true
                    }));
                    before = beforeQuery.items;
                    haveMoreBackward = beforeQuery.haveMore;
                }
                if (afterId && await Store.Message.findById(ctx, afterId)) {
                    let afterQuery = (await Modules.Messaging.fetchMessages(ctx, roomId, uid, {
                        after: afterId,
                        limit: args.first!
                    }));
                    after = afterQuery.items.reverse();
                    haveMoreForward = afterQuery.haveMore;
                }
                let aroundMessage: Message | undefined | null;
                if (aroundId) {
                    aroundMessage = await Store.Message.findById(ctx, aroundId);
                    if (aroundMessage && (aroundMessage.visibleOnlyForUids && aroundMessage.visibleOnlyForUids.length > 0 && !aroundMessage.visibleOnlyForUids.includes(uid))) {
                        aroundMessage = null;
                    }
                }
                messages = [...after, ...(aroundMessage && !aroundMessage.deleted) ? [aroundMessage] : [], ...before];
            } else {
                haveMoreForward = false;
                let beforeQuery = (await Modules.Messaging.fetchMessages(ctx, roomId, uid, { limit: args.first!, reverse: true }));
                messages = beforeQuery.items;
                haveMoreBackward = beforeQuery.haveMore;
            }

            return {
                haveMoreForward,
                haveMoreBackward,
                messages,
            };
        }),
        // modernMessages: withUser(async (ctx, args, uid) => {
        //     let roomId = IDs.Conversation.parse(args.chatId);
        //     if (
        //         !(await Modules.Messaging.room.canUserSeeChat(ctx, uid, roomId)) ||
        //         !args.first ||
        //         args.first <= 0
        //     ) {
        //         return {haveMoreForward: false, haveMoreBackward: false, messages: []};
        //     }
        //
        //     let beforeSeq = args.before || null;
        //     let afterSeq = args.after || null;
        //
        //     let haveMoreForward: boolean = false;
        //     let haveMoreBackward: boolean = false;
        //     let messages: Message[] = [];
        //
        //     if (beforeSeq || afterSeq) {
        //         let before: Message[] = [];
        //         let after: Message[] = [];
        //
        //         if (beforeSeq && await Store.Message.fromSeq.find(ctx, roomId, beforeSeq)) {
        //             let beforeQuery = (await fetchMessagesFromSeq(ctx, roomId, uid, {
        //                 after: beforeSeq,
        //                 limit: args.first!,
        //                 reverse: true
        //             }));
        //             before = beforeQuery.items;
        //             haveMoreBackward = beforeQuery.haveMore;
        //             haveMoreForward = true;
        //         }
        //         if (afterSeq && await Store.Message.fromSeq.find(ctx, roomId, afterSeq)) {
        //             let afterQuery = (await fetchMessagesFromSeq(ctx, roomId, uid, {
        //                 after: afterSeq,
        //                 limit: args.first!
        //             }));
        //             after = afterQuery.items.reverse();
        //             haveMoreForward = afterQuery.haveMore;
        //             haveMoreBackward = true;
        //         }
        //         messages = [...after, ...before];
        //     } else {
        //         haveMoreForward = false;
        //         let beforeQuery = (await fetchMessages(ctx, roomId, uid, {limit: args.first!, reverse: true}));
        //         messages = beforeQuery.items;
        //         haveMoreBackward = beforeQuery.haveMore;
        //     }
        //
        //     return {
        //         haveMoreForward,
        //         haveMoreBackward,
        //         messages,
        //     };
        // }),

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
            let seq = await Modules.Messaging.messaging.userReadSeqs.getUserReadSeqForChat(ctx, uid, chatId);
            let message = await Store.Message.chatSeq.query(ctx, chatId, { after: seq + 1, limit: 1, reverse: true });
            if (message.items.length > 0) {
                return message.items[0];
            } else {
                return null;
            }
        }),

        chatSharedMedia: withUser(async (ctx, args, uid) => {
            let chatId = IDs.Conversation.parse(args.chatId);
            await Modules.Messaging.room.checkAccess(ctx, uid, chatId);

            let cursor: number | null = null;
            if (args.before || args.after || args.around) {
                cursor = IDs.ConversationMessage.parse((args.before || args.around || args.after)!);
            }

            let leftSize = (args.around || args.before) ? args.first : 0;
            let rightSize = (args.around || args.after || !cursor) ? args.first : 0;

            let messages: (Message | PrivateMessage)[] = [];
            let leftHaveMore = false;
            let rightHaveMore = false;
            if (leftSize) {
                let left = await Promise.all(args.mediaTypes.map(a => Modules.Messaging.fetchMessagesWithAttachments(ctx, chatId, uid, a, {
                    after: cursor,
                    limit: leftSize
                })));
                let results: (Message | PrivateMessage)[] = [];
                for (let part of left) {
                    results = results.concat(part.items);
                    if (part.haveMore) {
                        leftHaveMore = true;
                    }
                }
                results = results.sort((a, b) => b.id - a.id);
                messages = messages.concat(results.slice(0, leftSize));
            }
            if (args.around) {
                let centerElement = await Store.Message.findById(ctx, cursor!);
                messages.push(centerElement!);
            }
            if (rightSize) {
                let right = await Promise.all(args.mediaTypes.map(a => Modules.Messaging.fetchMessagesWithAttachments(ctx, chatId, uid, a, {
                    after: cursor,
                    limit: rightSize,
                    reverse: true
                })));
                let results: (Message | PrivateMessage)[] = [];
                for (let part of right) {
                    results = results.concat(part.items);
                    if (part.haveMore) {
                        rightHaveMore = true;
                    }
                }
                results = results.sort((a, b) => b.id - a.id);
                messages = messages.concat(results.slice(0, rightSize));
            }
            return {
                edges: messages.filter(isDefined).map((p, i) => {
                    return {
                        node: {
                            message: p, chat: p!.cid,
                        },
                        cursor: IDs.ConversationMessage.serialize(p.id),
                        index: 0
                    };
                }), pageInfo: {
                    hasNextPage: rightHaveMore,
                    hasPreviousPage: leftHaveMore,

                    /* WTF Clients, why you are requesting this but don't use?? */
                    itemsCount: 0,
                    pagesCount: 0,
                    currentPage: 0
                },
            };
        }),
        chatSharedMediaCounters: withUser(async (ctx, args, uid) => {
            let chatId = IDs.Conversation.parse(args.chatId);
            await Modules.Messaging.room.checkAccess(ctx, uid, chatId);

            let privateConv = await Store.ConversationPrivate.findById(ctx, chatId);
            let forUid = 0;
            if (privateConv) {
                forUid = uid;
            }

            return {
                links: await Store.ChatMediaCounter.get(ctx, chatId, 'LINK', forUid),
                images: await Store.ChatMediaCounter.get(ctx, chatId, 'IMAGE', forUid),
                documents: await Store.ChatMediaCounter.get(ctx, chatId, 'DOCUMENT', forUid),
                videos: await Store.ChatMediaCounter.get(ctx, chatId, 'VIDEO', forUid)
            };
        }),
        haveAccessToChat: withUser(async (ctx, args, uid) => {
            return await Modules.Messaging.room.canUserSeeChat(ctx, uid, IDs.Conversation.parse(args.chatId));
        }),
        commonChatsWithUser: withUser(async (ctx, args, uid) => {
            if (args.first <= 0) {
                return {
                    items: [],
                    cursor: null,
                    count: 0
                };
            }
            let uid1Chats = await Modules.Messaging.room.getUserGroups(ctx, uid);
            let uid2Chats = await Modules.Messaging.room.getUserGroups(ctx, IDs.User.parse(args.uid));

            let commonChats = uid1Chats.filter(cid => uid2Chats.includes(cid));
            let items = commonChats;

            if (args.after) {
                items = items.filter(cid => cid > IDs.Conversation.parse(args.after!));
            }

            return {
                items: items.slice(0, args.first),
                cursor: items.length > args.first ? IDs.Conversation.serialize(items[args.first - 1]) : null,
                count: commonChats.length
            };
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
                spans.push(...convertMentionsToSpans(args.mentions));
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
                    } else if (span.type === 'Link' && span.url) {
                        spans.push({ offset: span.offset, length: span.length, type: 'link', url: span.url });
                    }
                }
            }

            //
            // File attachments
            //
            let attachments: MessageAttachmentInput[] = [];
            if (args.fileAttachments) {
                attachments = await saveFileAttachments(ctx, args.fileAttachments);
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
                spans,
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
                stickerId: sid,
            });

            return true;
        }),
        sendDonation: withUser(async (ctx, args, uid) => {
            if ((args.chatId && args.userId) || !(args.chatId || args.userId)) {
                throw new Error('chat id/user id should be specified');
            }
            let cid: number;
            if (args.chatId) {
                cid = IDs.Conversation.parse(args.chatId);
            } else {
                let uid2 = IDs.User.parse(args.userId!);
                let conv = await Modules.Messaging.room.resolvePrivateChat(ctx, uid, uid2);
                cid = conv.id;
            }

            await Modules.Messaging.donations.sendDonationMessage(ctx, uid, cid, args.amount, {
                message: args.message,
                repeatKey: args.repeatKey,
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
                spans.push(...convertMentionsToSpans(args.mentions));
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
                    } else if (span.type === 'Link' && span.url) {
                        spans.push({ offset: span.offset, length: span.length, type: 'link', url: span.url });
                    }
                }
            }

            //
            // File attachments
            //
            let attachments: MessageAttachmentInput[] = [];
            if (args.fileAttachments) {
                attachments = await saveFileAttachments(ctx, args.fileAttachments);
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
                spans,
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
            if (args.reaction === 'DONATE') {
                return false;
            }
            await Modules.Messaging.setReaction(ctx, IDs.ConversationMessage.parse(args.messageId), uid, args.reaction);
            return true;
        }),
        messageReactionRemove: withUser(async (ctx, args, uid) => {
            if (args.reaction === 'DONATE') {
                return false;
            }
            await Modules.Messaging.setReaction(ctx, IDs.ConversationMessage.parse(args.messageId), uid, args.reaction, true);
            return true;
        }),
        messageDonationReactionAdd: withUser(async (ctx, args, uid) => {
            await Modules.Messaging.donations.setReaction(ctx, IDs.ConversationMessage.parse(args.messageId), uid);
            return true;
        }),

        deleteChat: withUser(async (ctx, args, uid) => {
            let cid = IDs.Conversation.parse(args.chatId);
            let privateChat = await Store.ConversationPrivate.findById(ctx, cid);
            if (privateChat) {
                await Modules.Messaging.room.deletePrivateDialog(ctx, cid, uid, args.oneSide || false);
            } else {
                await Modules.Messaging.room.deleteRoom(ctx, cid, uid);
            }

            return true;
        }),
        archiveChat: withUser(async (ctx, args, uid) => {
            let cid = IDs.Conversation.parse(args.chatId);
            await Modules.Messaging.room.archiveRoom(ctx, cid, uid);
            return true;
        }),
    },
};
