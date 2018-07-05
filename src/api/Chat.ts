import { ConversationMessage } from '../tables/ConversationMessage';
import { IDs } from './utils/IDs';
import { Conversation } from '../tables/Conversation';
import { DB } from '../tables';
import { withPermission, withAny, withAccount, withUser } from './utils/Resolvers';
import { validate, stringNotEmpty } from '../modules/NewInputValidator';
import { NotFoundError } from '../errors/NotFoundError';
import { ConversationEvent } from '../tables/ConversationEvent';
import { CallContext } from './utils/CallContext';
import { Repos } from '../repositories';
import { DoubleInvokeError } from '../errors/DoubleInvokeError';
import { ConversationUserEvents } from '../tables/ConversationUserEvents';

export const Resolver = {
    Conversation: {
        __resolveType: (src: Conversation) => {
            if (src.type === 'anonymous') {
                return 'AnonymousConversation';
            } else if (src.type === 'shared') {
                return 'SharedConversation';
            } else if (src.type === 'private') {
                return 'PrivateConversation';
            } else {
                throw Error('Unsupported Conversation Type');
            }
        },
    },
    AnonymousConversation: {
        id: (src: Conversation) => IDs.Conversation.serialize(src.id),
        title: (src: Conversation) => src.title,
        photoRefs: (src: Conversation) => [],
        unreadCount: async (src: Conversation, _: any, context: CallContext) => {
            let state = await DB.ConversationUserState.find({ where: { conversationId: src.id, userId: context.uid!! } });
            if (state) {
                return state.unread;
            } else {
                return 0;
            }
        }
    },
    SharedConversation: {
        id: (src: Conversation) => IDs.Conversation.serialize(src.id),
        title: async (src: Conversation, _: any, context: CallContext) => {
            if (src.organization1Id === context.oid || (src.organization1 && src.organization1.id === context.oid)) {
                return (src.organization2 || await src.getOrganization2())!!.name;
            } else if (src.organization2Id === context.oid || (src.organization2 && src.organization2.id === context.oid)) {
                return (src.organization1 || await src.getOrganization1())!!.name;
            } else {
                throw Error('Inconsistent Shared Conversation resolver');
            }
        },
        photoRefs: (src: Conversation) => [],
        unreadCount: async (src: Conversation, _: any, context: CallContext) => {
            let state = await DB.ConversationUserState.find({ where: { conversationId: src.id, userId: context.uid!! } });
            if (state) {
                return state.unread;
            } else {
                return 0;
            }
        }
    },
    PrivateConversation: {
        id: (src: Conversation) => IDs.Conversation.serialize(src.id),
        title: async (src: Conversation, _: any, context: CallContext) => {
            let uid;
            if (src.member1Id === context.uid || (src.member1 && src.member1.id === context.uid)) {
                uid = (src.member2 || await src.getMember2())!!.id;
            } else if (src.member2Id === context.uid || (src.member2 && src.member2.id === context.uid)) {
                uid = (src.member1 || await src.getMember1())!!.id;
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
        photoRefs: (src: Conversation) => [],
        unreadCount: async (src: Conversation, _: any, context: CallContext) => {
            let state = await DB.ConversationUserState.find({ where: { conversationId: src.id, userId: context.uid!! } });
            if (state) {
                return state.unread;
            } else {
                return 0;
            }
        }
    },

    ConversationMessage: {
        id: (src: ConversationMessage) => IDs.ConversationMessage.serialize(src.id),
        message: (src: ConversationMessage) => src.message,
        sender: (src: ConversationMessage, _: any, context: CallContext) => Repos.Users.userLoader(context).load(src.userId),
        date: (src: ConversationMessage) => src.createdAt.toUTCString()
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
        isOut: (src: ConversationUserEvents, args: any, context: CallContext) => src.event.senderId === context.uid
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
        superAllChats: withPermission('software-developer', async (args, context) => {
            let res = await DB.ConversationUserState.findAll({
                where: {
                    userId: context.uid,
                    active: true
                },
                order: [['updatedAt', 'DESC']],
                include: [{
                    model: DB.Conversation,
                    as: 'conversation'
                }]
            });
            return res.map((v) => v.conversation!!);
        }),
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
        alphaChat: withAny<{ conversationId: string }>((args) => {
            let conversationId = IDs.Conversation.parse(args.conversationId);
            return DB.Conversation.findById(conversationId);
        }),
        alphaChatOrganization: withAccount<{ orgId: string }>(async (args, uid, oid) => {
            let orgId = IDs.Organization.parse(args.orgId);
            let oid1 = Math.min(oid, orgId);
            let oid2 = Math.max(oid, orgId);
            return await DB.tx(async (tx) => {
                let conversation = await DB.Conversation.find({
                    where: {
                        organization1Id: oid1,
                        organization2Id: oid2,
                        type: 'shared'
                    },
                    transaction: tx,
                    lock: tx.LOCK.UPDATE
                });
                if (conversation) {
                    return conversation;
                }
                let res = await DB.Conversation.create({
                    type: 'shared',
                    title: 'Cross Organization Chat',
                    organization1Id: oid1,
                    organization2Id: oid2
                });
                return res;
            });
        }),
        alphaChatUser: withAccount<{ userId: string }>(async (args, uid, oid) => {
            let userId = IDs.User.parse(args.userId);
            let uid1 = Math.min(uid, userId);
            let uid2 = Math.max(uid, userId);
            return await DB.tx(async (tx) => {
                let conversation = await DB.Conversation.find({
                    where: {
                        member1Id: uid1,
                        member2Id: uid2,
                        type: 'private'
                    },
                    transaction: tx,
                    lock: tx.LOCK.UPDATE
                });
                if (conversation) {
                    return conversation;
                }
                let res = await DB.Conversation.create({
                    type: 'private',
                    title: 'Private Chat',
                    member1Id: uid1,
                    member2Id: uid2
                });
                return res;
            });
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
        })
    },
    Mutation: {
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
        alphaSendMessage: withAccount<{ conversationId: string, message: string, repeatKey?: string | null }>(async (args, uid) => {
            validate({ message: stringNotEmpty() }, args);
            let conversationId = IDs.Conversation.parse(args.conversationId);
            return await DB.tx(async (tx) => {

                //
                // Handle retry
                //

                if (args.repeatKey) {
                    if (await DB.ConversationMessage.find({
                        where: {
                            userId: uid,
                            conversationId: conversationId,
                            repeatToken: args.repeatKey
                        },
                        transaction: tx,
                        lock: tx.LOCK.UPDATE
                    })) {
                        throw new DoubleInvokeError();
                    }
                }

                //
                // Increment sequence number
                //

                let conv = await DB.Conversation.findById(conversationId, { lock: tx.LOCK.UPDATE, transaction: tx });
                if (!conv) {
                    throw new NotFoundError('Conversation not found');
                }
                let seq = conv.seq + 1;
                conv.seq = seq;
                await conv.save({ transaction: tx });

                // 
                // Persist Messages
                //

                let msg = await DB.ConversationMessage.create({
                    message: args.message,
                    conversationId: conversationId,
                    userId: uid,
                    repeatToken: args.repeatKey
                }, { transaction: tx });
                let res = await DB.ConversationEvent.create({
                    conversationId: conversationId,
                    eventType: 'new_message',
                    event: {
                        messageId: msg.id
                    },
                    seq: seq
                }, { transaction: tx });

                //
                // Unread Counters
                //
                let members: number[] = [];
                if (conv.type === 'private') {
                    // if (conv.member1Id !== uid) {
                    //     members.push(conv.member1Id!!);
                    // }
                    // if (conv.member2Id !== uid) {
                    //     members.push(conv.member2Id!!);
                    // }
                    members = [conv.member1Id!!, conv.member2Id!!];
                } else if (conv.type === 'shared') {
                    for (let i of await Repos.Organizations.getOrganizationMembers(conv.organization1Id!!)) {
                        if (members.indexOf(i.userId) < 0) {
                            members.push(i.userId);
                        }
                    }
                    for (let i of await Repos.Organizations.getOrganizationMembers(conv.organization2Id!!)) {
                        if (members.indexOf(i.userId) < 0) {
                            members.push(i.userId);
                        }
                    }
                }
                if (members.length > 0) {
                    let currentStates = await DB.ConversationUserState.findAll({
                        where: {
                            conversationId: conversationId,
                            userId: {
                                $in: members
                            }
                        },
                        transaction: tx,
                        lock: tx.LOCK.UPDATE
                    });
                    let currentGlobals = await DB.ConversationsUserGlobal.findAll({
                        where: {
                            userId: {
                                $in: members
                            }
                        },
                        transaction: tx,
                        lock: tx.LOCK.UPDATE
                    });
                    for (let m of members) {
                        let existing = currentStates.find((v) => v.userId === m);
                        let existingGlobal = currentGlobals.find((v) => v.userId === m);
                        let userSeq = 1;
                        let userUnread = 0;
                        let userChatUnread = 0;

                        // Write user's chat state
                        if (m !== uid) {
                            if (existing) {
                                existing.unread++;
                                userChatUnread = existing.unread;
                                await existing.save({ transaction: tx });
                            } else {
                                userUnread = 1;
                                await DB.ConversationUserState.create({
                                    conversationId: conversationId,
                                    userId: m,
                                    unread: 1
                                }, { transaction: tx });

                            }
                        } else {
                            if (existing) {
                                (existing as any).changed('updatedAt', true);
                                await existing.save({ transaction: tx });
                            } else {
                                await DB.ConversationUserState.create({
                                    conversationId: conversationId,
                                    userId: m,
                                    unread: 0
                                }, { transaction: tx });
                            }
                        }

                        // Update or Create global state
                        if (existingGlobal) {
                            if (m !== uid) {
                                existingGlobal.unread++;
                            }
                            existingGlobal.seq++;
                            userSeq = existingGlobal.seq;
                            userUnread = existingGlobal.unread;
                            await existingGlobal.save({ transaction: tx });
                        } else {
                            if (m !== uid) {
                                userUnread = 1;
                                await DB.ConversationsUserGlobal.create({
                                    userId: m,
                                    unread: 1,
                                    seq: 1
                                }, { transaction: tx });
                            } else {
                                userUnread = 0;
                                await DB.ConversationsUserGlobal.create({
                                    userId: m,
                                    unread: 0,
                                    seq: 1
                                }, { transaction: tx });
                            }
                        }

                        // Write User Event
                        await DB.ConversationUserEvents.create({
                            userId: m,
                            seq: userSeq,
                            eventType: 'new_message',
                            event: {
                                conversationId: conversationId,
                                messageId: res.id,
                                unreadGlobal: userUnread,
                                unread: userChatUnread,
                                senderId: uid
                            }
                        }, { transaction: tx });
                    }
                }

                return res;
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