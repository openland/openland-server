import { CallContext } from 'openland-server/api/utils/CallContext';
import { ConversationUserEvents } from 'openland-server/tables/ConversationUserEvents';
import { DB } from 'openland-server/tables';
import { Repos } from 'openland-server/repositories';

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
            } else if (obj.eventType === 'DialogMessageUpdated') {
                return 'DialogMessageUpdated';
            } else if (obj.eventType === 'delete_message') {
                return 'DialogMessageDeleted';
            } else if (obj.eventType === 'conversation_read') {
                return 'DialogMessageRead';
            } else if (obj.eventType === 'title_change') {
                return 'DialogTitleUpdated';
            } else if (obj.eventType === 'chat_update') {
                return 'DialogPhotoUpdated';
            }
            throw Error('Unknown dialog update type: ' + obj.eventType);
        }
    },
    DialogMessageReceived: {

    },
    DialogMessageUpdated: {

    },
    DialogMessageDeleted: {

    },
    DialogMessageRead: {

    },
    DialogTitleUpdated: {

    },
    DialogPhotoUpdated: {

    },

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
                                // events.filter((v)=>{
                                //     v.eventType !== ''
                                // })
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