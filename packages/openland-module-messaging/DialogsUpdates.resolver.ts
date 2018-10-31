import { CallContext } from 'openland-server/api/utils/CallContext';
import { ConversationUserEvents } from 'openland-server/tables/ConversationUserEvents';
import { DB } from 'openland-server/tables';
import { Repos } from 'openland-server/repositories';
import { IDs } from 'openland-server/api/utils/IDs';

export default {
    /* 
     * Dialog Update Containers
     */
    DialogUpdateContainer: {
        __resolveType(obj: ConversationUserEvents | ConversationUserEvents[]) {
            if (Array.isArray(obj)) {
                if (obj.length < 2) {
                    throw Error('Unable to resolve batch update for less than two updates!');
                }
                return 'DialogUpdateBatch';
            } else {
                return 'DialogUpdateSingle';
            }
        }
    },
    DialogUpdateBatch: {
        updates: (src: ConversationUserEvents[]) => src,
        fromSeq: (src: ConversationUserEvents[]) => src[0].seq,
        seq: (src: ConversationUserEvents[]) => src[src.length - 1].seq,
        state: (src: ConversationUserEvents[]) => '00' + src[src.length - 1].seq
    },
    DialogUpdateSingle: {
        seq: (src: ConversationUserEvents) => src.seq,
        state: (src: ConversationUserEvents) => '00' + src.seq,
        update: (src: ConversationUserEvents) => src,
    },
    /*
     * Dialog Updates
     */
    DialogUpdate: {
        __resolveType(obj: ConversationUserEvents) {
            if (obj.eventType === 'new_message') {
                return 'DialogMessageReceived';
            } else if (obj.eventType === 'edit_message') {
                return 'DialogMessageUpdated';
            } else if (obj.eventType === 'delete_message') {
                return 'DialogMessageDeleted';
            } else if (obj.eventType === 'conversation_read') {
                return 'DialogMessageRead';
            } else if (obj.eventType === 'title_change') {
                return 'DialogTitleUpdated';
            }
            // } else if (obj.eventType === 'chat_update') {
            //     return 'DialogPhotoUpdated';
            // }
            throw Error('Unknown dialog update type: ' + obj.eventType);
        }
    },
    DialogMessageReceived: {
        cid: (src: ConversationUserEvents) => IDs.Conversation.serialize(src.event.conversationId as any),
        message: (src: ConversationUserEvents) => DB.ConversationMessage.findById(src.event.messageId as any, { paranoid: false }),
        unread: (src: ConversationUserEvents) => src.event.unread,
        globalUnread: (src: ConversationUserEvents) => src.event.unreadGlobal
    },
    DialogMessageUpdated: {
        message: (src: ConversationUserEvents) => DB.ConversationMessage.findById(src.event.messageId as any, { paranoid: false }),
    },
    DialogMessageDeleted: {
        message: (src: ConversationUserEvents) => DB.ConversationMessage.findById(src.event.messageId as any, { paranoid: false }),
    },
    DialogMessageRead: {
        cid: (src: ConversationUserEvents) => IDs.Conversation.serialize(src.event.conversationId as any),
        unread: (src: ConversationUserEvents) => src.event.unread,
        globalUnread: (src: ConversationUserEvents) => src.event.unreadGlobal
    },
    DialogTitleUpdated: {
        cid: (src: ConversationUserEvents) => IDs.Conversation.serialize(src.event.conversationId as any),
        title: (src: ConversationUserEvents) => src.event.title,
    },
    // DialogPhotoUpdated: {
    //     photoRef: async (src: ConversationUserEvents) => (await DB.Conversation.findById(src.event.conversationId as any))!.,
    // },

    /*
     * Subscription
     */
    Subscription: {
        dialogsUpdates: {
            resolve: async (msg: any) => {
                return msg;
            },
            subscribe: async function (_: any, args: { fromState?: string }, context: CallContext) {
                let ended = false;
                let startSeq = args.fromState ? parseInt(args.fromState.substr(2), 10) : undefined;
                function isSupported(type: string) {
                    if (type === 'new_message') {
                        return true;
                    } else if (type === 'edit_message') {
                        return true;
                    } else if (type === 'delete_message') {
                        return true;
                    } else if (type === 'conversation_read') {
                        return true;
                    } else if (type === 'title_change') {
                        return true;
                    }
                    // } else if (type === 'chat_update') {
                    //     return true;
                    // }

                    return false;
                }
                return {
                    ...(async function* func() {
                        let lastKnownSeq = startSeq;
                        while (!ended) {
                            if (lastKnownSeq !== undefined) {
                                let events = await DB.ConversationUserEvents.findAll({
                                    where: {
                                        userId: context.uid,
                                        seq: {
                                            $gt: lastKnownSeq
                                        }
                                    },
                                    order: [['seq', 'asc']]
                                });
                                events = events.filter((v) => isSupported(v.eventType));
                                if (events.length > 1) {
                                    yield events;
                                } else if (events.length === 1) {
                                    yield events[0];
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
        },
    }
};