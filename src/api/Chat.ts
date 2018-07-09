import { ConversationMessage } from '../tables/ConversationMessage';
import { IDs, IdsFactory } from './utils/IDs';
import { Conversation } from '../tables/Conversation';
import { DB } from '../tables';
import { withPermission, withAny, withAccount, withUser } from './utils/Resolvers';
import { validate, stringNotEmpty } from '../modules/NewInputValidator';
import { ConversationEvent } from '../tables/ConversationEvent';
import { CallContext } from './utils/CallContext';
import { Repos } from '../repositories';
import { ConversationUserEvents } from '../tables/ConversationUserEvents';
import request from 'request';
import { JsonMap } from '../utils/json';
import { IDMailformedError } from '../errors/IDMailformedError';
import { ImageRef, buildBaseImageUrl } from '../repositories/Media';

export const Resolver = {
    Conversation: {
        __resolveType: (src: Conversation) => {
            if (src.type === 'anonymous') {
                return 'AnonymousConversation';
            } else if (src.type === 'shared') {
                return 'SharedConversation';
            } else if (src.type === 'private') {
                return 'PrivateConversation';
            } else if (src.type === 'group') {
                return 'GroupConversation';
            } else {
                throw Error('Unsupported Conversation Type');
            }
        },
    },
    AnonymousConversation: {
        id: (src: Conversation) => IDs.Conversation.serialize(src.id),
        flexibleId: (src: Conversation) => IDs.Conversation.serialize(src.id),
        title: (src: Conversation) => src.title,
        photos: (src: Conversation) => [],
        unreadCount: async (src: Conversation, _: any, context: CallContext) => {
            let state = await DB.ConversationUserState.find({ where: { conversationId: src.id, userId: context.uid!! } });
            if (state) {
                return state.unread;
            } else {
                return 0;
            }
        },
        topMessage: (src: Conversation) => DB.ConversationMessage.find({
            where: {
                conversationId: src.id,
            },
            order: [['id', 'DESC']]
        })
    },
    SharedConversation: {
        id: (src: Conversation) => IDs.Conversation.serialize(src.id),
        flexibleId: (src: Conversation, _: any, context: CallContext) => {
            if (src.organization1Id === context.oid || (src.organization1 && src.organization1.id === context.oid)) {
                return IDs.Organization.serialize(src.organization2Id!!);
            } else if (src.organization2Id === context.oid || (src.organization2 && src.organization2.id === context.oid)) {
                return IDs.Organization.serialize(src.organization1Id!!);
            } else {
                throw Error('Inconsistent Shared Conversation resolver');
            }
        },
        title: async (src: Conversation, _: any, context: CallContext) => {
            if (src.organization1Id === context.oid || (src.organization1 && src.organization1.id === context.oid)) {
                return (src.organization2 || await src.getOrganization2())!!.name;
            } else if (src.organization2Id === context.oid || (src.organization2 && src.organization2.id === context.oid)) {
                return (src.organization1 || await src.getOrganization1())!!.name;
            } else {
                throw Error('Inconsistent Shared Conversation resolver');
            }
        },
        photos: async (src: Conversation, _: any, context: CallContext) => {
            let photo: ImageRef | null = null;
            if (src.organization1Id === context.oid || (src.organization1 && src.organization1.id === context.oid)) {
                photo = (src.organization2 || await src.getOrganization2())!!.photo!!;
            } else if (src.organization2Id === context.oid || (src.organization2 && src.organization2.id === context.oid)) {
                photo = (src.organization1 || await src.getOrganization1())!!.photo!!;
            } else {
                throw Error('Inconsistent Shared Conversation resolver');
            }
            if (photo) {
                return [buildBaseImageUrl(photo)];
            } else {
                return [];
            }
        },
        unreadCount: async (src: Conversation, _: any, context: CallContext) => {
            let state = await DB.ConversationUserState.find({ where: { conversationId: src.id, userId: context.uid!! } });
            if (state) {
                return state.unread;
            } else {
                return 0;
            }
        },
        topMessage: (src: Conversation) => DB.ConversationMessage.find({
            where: {
                conversationId: src.id,
            },
            order: [['id', 'DESC']]
        })
    },
    PrivateConversation: {
        id: (src: Conversation) => IDs.Conversation.serialize(src.id),
        flexibleId: (src: Conversation, _: any, context: CallContext) => {
            let uid;
            if (src.member1Id === context.uid || (src.member1 && src.member1.id === context.uid)) {
                uid = src.member2Id!!;
            } else if (src.member2Id === context.uid || (src.member2 && src.member2.id === context.uid)) {
                uid = src.member1Id!!;
            } else {
                throw Error('Inconsistent Shared Conversation resolver');
            }
            return IDs.User.serialize(uid);
        },
        title: async (src: Conversation, _: any, context: CallContext) => {
            let uid;
            if (src.member1Id === context.uid || (src.member1 && src.member1.id === context.uid)) {
                uid = src.member2Id!!;
            } else if (src.member2Id === context.uid || (src.member2 && src.member2.id === context.uid)) {
                uid = src.member1Id!!;
            } else {
                throw Error('Inconsistent Shared Conversation resolver');
            }
            let profile = (await DB.UserProfile.find({
                where: {
                    userId: uid
                }
            }))!!;
            return [profile.firstName, profile.lastName].filter((v) => !!v).join(' ');
        },
        photos: async (src: Conversation, _: any, context: CallContext) => {
            let uid;
            if (src.member1Id === context.uid || (src.member1 && src.member1.id === context.uid)) {
                uid = src.member2Id!!;
            } else if (src.member2Id === context.uid || (src.member2 && src.member2.id === context.uid)) {
                uid = src.member1Id!!;
            } else {
                throw Error('Inconsistent Shared Conversation resolver');
            }
            let profile = (await DB.UserProfile.find({
                where: {
                    userId: uid
                }
            }))!!;

            if (profile.picture) {
                return [buildBaseImageUrl(profile.picture)];
            } else {
                return [];
            }
        },
        unreadCount: async (src: Conversation, _: any, context: CallContext) => {
            let state = await DB.ConversationUserState.find({ where: { conversationId: src.id, userId: context.uid!! } });
            if (state) {
                return state.unread;
            } else {
                return 0;
            }
        },
        topMessage: (src: Conversation) => DB.ConversationMessage.find({
            where: {
                conversationId: src.id,
            },
            order: [['id', 'DESC']]
        })
    },
    GroupConversation: {
        id: (src: Conversation) => IDs.Conversation.serialize(src.id),
        flexibleId: (src: Conversation) => IDs.Conversation.serialize(src.id),
        title: async (src: Conversation, _: any, context: CallContext) => {
            if (src.title !== '') {
                return src.title;
            }
            let res = await DB.ConversationGroupMembers.findAll({
                where: {
                    conversationId: src.id,
                    userId: {
                        $not: context.uid
                    }
                },
                order: ['userId']
            });
            let name: string[] = [];
            for (let r of res) {
                let p = (await DB.UserProfile.find({ where: { userId: r.userId } }))!!;
                name.push([p.firstName, p.lastName].filter((v) => !!v).join(' '));
            }
            return name.join(', ');
        },
        photos: async (src: Conversation, _: any, context: CallContext) => {
            let res = await DB.ConversationGroupMembers.findAll({
                where: {
                    conversationId: src.id,
                    userId: {
                        $not: context.uid
                    }
                },
                order: ['userId']
            });
            let photos: string[] = [];
            for (let r of res) {
                let p = (await DB.UserProfile.find({ where: { userId: r.userId } }))!!.picture;
                if (p) {
                    photos.push(buildBaseImageUrl(p));
                }
                if (photos.length >= 4) {
                    break;
                }
            }
            return photos;
        },
        members: (src: Conversation) => {
            return DB.ConversationGroupMembers.findAll({
                where: {
                    conversationId: src.id
                },
                order: ['userId']
            });
        },
        unreadCount: async (src: Conversation, _: any, context: CallContext) => {
            let state = await DB.ConversationUserState.find({ where: { conversationId: src.id, userId: context.uid!! } });
            if (state) {
                return state.unread;
            } else {
                return 0;
            }
        },
        topMessage: (src: Conversation) => DB.ConversationMessage.find({
            where: {
                conversationId: src.id,
            },
            order: [['id', 'DESC']]
        })
    },

    ConversationMessage: {
        id: (src: ConversationMessage) => IDs.ConversationMessage.serialize(src.id),
        message: (src: ConversationMessage) => src.message,
        file: (src: ConversationMessage) => src.fileId,
        fileMetadata: (src: ConversationMessage) => {
            if (src.fileId && src.fileMetadata) {
                return {
                    name: src.fileMetadata.name,
                    mimeType: src.fileMetadata.mimeType,
                    isImage: src.fileMetadata.isImage,
                    imageWidth: src.fileMetadata.imageWidth,
                    imageHeight: src.fileMetadata.imageHeight,
                    imageFormat: src.fileMetadata.imageFormat,
                    size: src.fileMetadata.size
                };
            } else {
                return null;
            }
        },
        sender: (src: ConversationMessage, _: any, context: CallContext) => Repos.Users.userLoader(context).load(src.userId),
        date: (src: ConversationMessage) => src.createdAt,
        repeatKey: (src: ConversationMessage, args: any, context: CallContext) => src.userId === context.uid ? src.repeatToken : null
    },
    ConversationEvent: {
        __resolveType(obj: ConversationEvent) {
            if (obj.eventType === 'new_message') {
                return 'ConversationEventMessage';
            } else if (obj.eventType === 'delete_message') {
                return 'ConversationEventDelete';
            }
            throw Error('Unknown type');
        },
        seq: (src: ConversationEvent) => src.seq
    },
    ConversationEventMessage: {
        message: (src: ConversationEvent) => DB.ConversationMessage.findById(src.event.messageId as number)
    },
    ConversationEventDelete: {
        messageId: (src: ConversationEvent) => IDs.ConversationMessage.serialize(src.event.messageId as number)
    },
    ChatReadResult: {
        conversation: (src: { uid: number, conversationId: number }) => DB.Conversation.findById(src.conversationId),
        counter: (src: { uid: number, conversationId: number }) => src.uid
    },

    UserEvent: {
        __resolveType(obj: ConversationUserEvents) {
            if (obj.eventType === 'new_message') {
                return 'UserEventMessage';
            } else if (obj.eventType === 'conversation_read') {
                return 'UserEventRead';
            }
            throw Error('Unknown type');
        }
    },
    UserEventMessage: {
        seq: (src: ConversationUserEvents) => src.seq,
        unread: (src: ConversationUserEvents) => src.event.unread,
        globalUnread: (src: ConversationUserEvents) => src.event.unreadGlobal,
        conversationId: (src: ConversationUserEvents) => IDs.Conversation.serialize(src.event.conversationId as any),
        message: (src: ConversationUserEvents) => DB.ConversationMessage.findById(src.event.messageId as any),
        conversation: (src: ConversationUserEvents) => DB.Conversation.findById(src.event.conversationId as any),
        isOut: (src: ConversationUserEvents, args: any, context: CallContext) => src.event.senderId === context.uid,
        repeatKey: (src: ConversationUserEvents, args: any, context: CallContext) => src.event.senderId === context.uid ? DB.ConversationMessage.findById(src.event.messageId as any).then((v) => v && v.repeatToken) : null
    },
    UserEventRead: {
        seq: (src: ConversationUserEvents) => src.seq,
        unread: (src: ConversationUserEvents) => src.event.unread,
        globalUnread: (src: ConversationUserEvents) => src.event.unreadGlobal,
        conversationId: (src: ConversationUserEvents) => IDs.Conversation.serialize(src.event.conversationId as any),
    },

    NotificationCounter: {
        id: (src: number | { uid: number, counter: number }) => {
            if (typeof src === 'number') {
                return IDs.NotificationCounter.serialize(src);
            } else {
                return IDs.NotificationCounter.serialize(src.uid);
            }
        },
        unreadCount: async (src: number | { uid: number, counter: number }) => {
            if (typeof src === 'number') {
                let global = await DB.ConversationsUserGlobal.find({ where: { userId: src } });
                if (global) {
                    return global.unread;
                } else {
                    return 0;
                }
            } else {
                return src.counter;
            }
        }
    },
    Query: {
        alphaNotificationCounter: withUser((args, uid) => uid),
        alphaChats: withAccount<{ first: number, after?: string | null }>(async (args, uid, oid) => {
            return await DB.tx(async (tx) => {
                let global = await DB.ConversationsUserGlobal.find({ where: { userId: uid }, transaction: tx });
                let conversations = await DB.ConversationUserState.findAll({
                    where: {
                        userId: uid,
                    },
                    order: [['updatedAt', 'DESC']],
                    limit: args.first,
                    include: [{
                        model: DB.Conversation,
                        as: 'conversation'
                    }]
                });
                return {
                    conversations: conversations.map((v) => v.conversation!!),
                    seq: global ? global.seq : 0,
                    next: null,
                    counter: uid
                };
            });
        }),
        alphaChat: withAccount<{ conversationId: string }>((args, uid, oid) => {
            let id = IdsFactory.resolve(args.conversationId);
            if (id.type === IDs.Conversation) {
                return DB.Conversation.findById(id.id);
            } else if (id.type === IDs.User) {
                return Repos.Chats.loadPrivateChat(id.id, uid);
            } else if (id.type === IDs.Organization) {
                return Repos.Chats.loadOrganizationalChat(oid, id.id);
            } else {
                throw new IDMailformedError('Invalid id');
            }
        }),
        alphaLoadMessages: withAny<{ conversationId: string }>((args) => {
            let conversationId = IDs.Conversation.parse(args.conversationId);
            return DB.tx(async (tx) => {
                let seq = (await DB.Conversation.findById(conversationId))!!.seq;
                return {
                    seq: seq,
                    messages: await (DB.ConversationMessage.findAll({
                        where: {
                            conversationId: conversationId
                        },
                        order: [['id', 'DESC']],
                        transaction: tx
                    }))
                };
            });
        }),
        alphaChatsSearchForCompose: withAccount<{ query: string }>(async (args, uid, oid) => {
            return await DB.User.findAll({
                where: {
                    email: {
                        $like: args.query + '%'
                    }
                },
                limit: 10
            });
        })
    },
    Mutation: {
        alphaChatCreateGroup: withAccount<{ title?: string | null, message: string, members: string[] }>(async (args, uid, oid) => {
            return await DB.txStable(async (tx) => {
                let title = args.title ? args.title!! : '';
                let conv = await DB.Conversation.create({
                    title: title,
                    type: 'group'
                }, { transaction: tx });
                let members = [uid, ...args.members.map((v) => IDs.User.parse(v))];
                for (let m of members) {
                    await DB.ConversationGroupMembers.create({
                        conversationId: conv.id,
                        invitedById: uid,
                        userId: m
                    }, { transaction: tx });
                }
                await Repos.Chats.sendMessage(tx, conv.id, uid, { message: args.message });
                return conv;
            });
        }),
        superCreateChat: withPermission<{ title: string }>('software-developer', (args) => {
            validate({ title: stringNotEmpty() }, args);
            return DB.Conversation.create({
                title: args.title
            });
        }),
        alphaReadChat: withAccount<{ conversationId: string, messageId: string }>(async (args, uid) => {
            let conversationId = IDs.Conversation.parse(args.conversationId);
            let messageId = IDs.ConversationMessage.parse(args.messageId);
            await DB.txStable(async (tx) => {
                let existing = await DB.ConversationUserState.find({
                    where: {
                        userId: uid,
                        conversationId: conversationId
                    },
                    transaction: tx,
                    lock: tx.LOCK.UPDATE
                });
                let existingGlobal = await DB.ConversationsUserGlobal.find({
                    where: {
                        userId: uid
                    },
                    transaction: tx,
                    lock: tx.LOCK.UPDATE
                });
                let delta = 0;
                let totalUnread = 0;
                if (existing) {
                    if (existing.readDate < messageId) {
                        let remaining = await DB.ConversationMessage.count({
                            where: {
                                conversationId,
                                id: {
                                    $gt: messageId
                                },
                                userId: {
                                    $not: uid
                                }
                            }
                        });
                        if (!existingGlobal) {
                            throw Error('Internal inconsistency');
                        }
                        if (remaining === 0) {
                            delta = -existing.unread;
                            existing.unread = 0;
                            existing.readDate = 0;
                        } else {
                            delta = remaining - existing.unread;
                            existing.unread = remaining;
                            existing.readDate = messageId;
                            totalUnread = remaining;
                        }
                        await existing.save({ transaction: tx });
                    }
                } else {
                    let remaining = await DB.ConversationMessage.count({
                        where: {
                            conversationId,
                            id: {
                                $gt: messageId
                            },
                            userId: {
                                $not: uid
                            }
                        }
                    });
                    if (remaining > 0) {
                        await DB.ConversationUserState.create({
                            userId: uid,
                            conversationId: conversationId,
                            readDate: messageId,
                            unread: remaining
                        });
                        delta = remaining;
                        if (!existingGlobal) {
                            throw Error('Internal inconsistency');
                        }
                    }
                }
                if (existingGlobal && delta !== 0) {

                    //
                    // Update Global State
                    //

                    let unread = existingGlobal.unread + delta;
                    if (unread < 0) {
                        throw Error('Internal inconsistency');
                    }
                    existingGlobal.unread = unread;
                    existingGlobal.seq++;
                    await existingGlobal.save({ transaction: tx });

                    //
                    // Write Event
                    //

                    await DB.ConversationUserEvents.create({
                        seq: existingGlobal.seq,
                        userId: uid,
                        eventType: 'conversation_read',
                        event: {
                            conversationId: conversationId,
                            unread: totalUnread,
                            unreadGlobal: existingGlobal.unread
                        }
                    }, { transaction: tx });
                }
            });
            return {
                uid: uid,
                conversationId: conversationId
            };
        }),
        alphaSendMessage: withAccount<{ conversationId: string, message?: string | null, file?: string | null, repeatKey?: string | null }>(async (args, uid) => {
            // validate({ message: stringNotEmpty() }, args);
            let conversationId = IDs.Conversation.parse(args.conversationId);

            let fileMetadata: JsonMap | null;
            if (args.file) {
                let res = await new Promise<any>(
                    (resolver, reject) => request(
                        {
                            url: 'https://api.uploadcare.com/files/' + args.file!! + '/',
                            headers: {
                                'Authorization': 'Uploadcare.Simple b70227616b5eac21ba88:65d4918fb06d4fe0bec8'
                            }
                        },
                        (error, response, body) => {
                            if (!error && response.statusCode === 200) {
                                resolver(JSON.parse(body));
                            } else {
                                reject(error);
                            }
                        }));
                console.warn(res);
                let isImage = res.is_image as boolean;
                let imageWidth = isImage ? res.image_info.width as number : null;
                let imageHeight = isImage ? res.image_info.height as number : null;
                let imageFormat = isImage ? res.image_info.format as string : null;
                let mimeType = res.mime_type as string;
                let name = res.original_filename as string;
                let size = res.size as number;
                fileMetadata = {
                    isImage: isImage,
                    mimeType: mimeType,
                    name: name,
                    size: size,
                    imageWidth,
                    imageHeight,
                    imageFormat
                };
            }
            return await DB.txStable(async (tx) => {
                return await Repos.Chats.sendMessage(tx, conversationId, uid!, {
                    message: args.message,
                    file: args.file,
                    fileMetadata: fileMetadata,
                    repeatKey: args.repeatKey
                });
            });
        })
    },
    Subscription: {
        alphaChatSubscribe: {
            resolve: async (msg: any) => {
                return msg;
            },
            subscribe: async function (_: any, args: { conversationId: string, fromSeq?: number }) {
                let conversationId = IDs.Conversation.parse(args.conversationId);
                let ended = false;
                return {
                    ...async function* func() {
                        let lastKnownSeq = args.fromSeq;
                        while (!ended) {
                            if (lastKnownSeq !== undefined) {
                                let events = await DB.ConversationEvent.findAll({
                                    where: {
                                        conversationId: conversationId,
                                        seq: {
                                            $gt: lastKnownSeq
                                        }
                                    },
                                    order: ['seq']
                                });
                                for (let r of events) {
                                    yield r;
                                }
                                if (events.length > 0) {
                                    lastKnownSeq = events[events.length - 1].seq;
                                }
                            }
                            let res = await new Promise<number>((resolve) => Repos.Chats.reader.loadNext(conversationId, lastKnownSeq ? lastKnownSeq : null, (arg) => resolve(arg)));
                            if (!lastKnownSeq) {
                                lastKnownSeq = res - 1;
                            }
                        }
                    }(),
                    return: async () => {
                        ended = true;
                        return 'ok';
                    }
                };
            }
        },
        alphaNotificationCounterSubscribe: {
            resolve: async (msg: any) => {
                return msg;
            },
            subscribe: async function (_: any, args: any, context: CallContext) {
                if (!context.uid) {
                    throw Error('Not logged in');
                }
                let ended = false;
                return {
                    ...async function* func() {
                        let state = await DB.ConversationsUserGlobal.find({ where: { userId: context.uid!! } });
                        if (state) {
                            yield {
                                counter: state.unread,
                                uid: context.uid
                            };
                        }
                        while (!ended) {
                            let counter = await Repos.Chats.counterReader.loadNext(context.uid!!);
                            yield {
                                counter,
                                uid: context.uid
                            };
                        }
                    }(),
                    return: async () => {
                        ended = true;
                        return 'ok';
                    }
                };
            }
        },
        alphaSubscribeEvents: {
            resolve: async (msg: any) => {
                return msg;
            },
            subscribe: async function (_: any, args: { fromSeq?: number }, context: CallContext) {
                let ended = false;
                return {
                    ...(async function* func() {
                        let lastKnownSeq = args.fromSeq;
                        while (!ended) {
                            if (lastKnownSeq !== undefined && lastKnownSeq > 0) {
                                let events = await DB.ConversationUserEvents.findAll({
                                    where: {
                                        userId: context.uid,
                                        seq: {
                                            $gt: lastKnownSeq
                                        }
                                    },
                                    order: [['seq', 'asc']]
                                });
                                for (let r of events) {
                                    yield r;
                                }
                                if (events.length > 0) {
                                    lastKnownSeq = events[events.length - 1].seq;
                                }
                            }
                            let res = await Repos.Chats.userReader.loadNext(context.uid!!, lastKnownSeq ? lastKnownSeq : null);
                            if (!lastKnownSeq) {
                                lastKnownSeq = res - 1;
                            }
                        }
                    })(),
                    return: async () => {
                        ended = true;
                        return 'ok';
                    }
                };
            }
        }
    }
};