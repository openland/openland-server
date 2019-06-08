import { IDs } from 'openland-module-api/IDs';
import { ConversationEvent } from 'openland-module-db/schema';
import { FDB } from 'openland-module-db/FDB';
import { FLiveStreamItem } from 'foundation-orm/FLiveStreamItem';
import { GQL, GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
import { AppContext } from 'openland-modules/AppContext';
import { withUser } from 'openland-module-api/Resolvers';
import { AccessDeniedError } from '../../openland-errors/AccessDeniedError';
import { EventBus } from '../../openland-module-pubsub/EventBus';
import { Modules } from '../../openland-modules/Modules';
import { delay } from '../../openland-utils/timer';

export default {
    /* 
     * Conversation Update Containers
     */
    ConversationUpdateContainer: {
        __resolveType(obj: FLiveStreamItem<ConversationEvent>) {
            if (obj.items.length === 1) {
                return 'ConversationUpdateSingle';
            } else {
                return 'ConversationUpdateBatch';
            }
        }
    },
    ConversationUpdateBatch: {
        updates: (src: FLiveStreamItem<ConversationEvent>) => src.items,
        fromSeq: (src: FLiveStreamItem<ConversationEvent>) => src.items[0].seq,
        seq: (src: FLiveStreamItem<ConversationEvent>) => src.items[src.items.length - 1].seq,
        state: (src: FLiveStreamItem<ConversationEvent>) => src.cursor
    },
    ConversationUpdateSingle: {
        seq: (src: FLiveStreamItem<ConversationEvent>) => src.items[0].seq,
        state: (src: FLiveStreamItem<ConversationEvent>) => src.cursor,
        update: (src: FLiveStreamItem<ConversationEvent>) => src.items[0],
    },

    /*
     * Conversation Updates
     */
    ConversationUpdated: {
        chat: src => src.cid,
        by: src => src.uid
    },
    ConversationUpdate: {
        __resolveType(obj: ConversationEvent | { kind: 'lost_access' }) {
            if (obj.kind === 'message_received') {
                return 'ConversationMessageReceived';
            } else if (obj.kind === 'message_updated') {
                return 'ConversationMessageUpdated';
            } else if (obj.kind === 'message_deleted') {
                return 'ConversationMessageDeleted';
            } else if (obj.kind === 'lost_access') {
                return 'ConversationLostAccess';
            } else if (obj.kind === 'chat_updated') {
                return 'ConversationUpdated';
            }
            throw Error('Unknown conversation update type: ' + obj.kind);
        }
    },

    ConversationMessageReceived: {
        message: (src: ConversationEvent, args: {}, ctx: AppContext) => FDB.Message.findById(ctx, src.mid!),
        betaMessage: (src: ConversationEvent, args: {}, ctx: AppContext) => FDB.Message.findById(ctx, src.mid!),
    },
    ConversationMessageUpdated: {
        message: (src: ConversationEvent, args: {}, ctx: AppContext) => FDB.Message.findById(ctx, src.mid!),
        betaMessage: (src: ConversationEvent, args: {}, ctx: AppContext) => FDB.Message.findById(ctx, src.mid!),
    },
    ConversationMessageDeleted: {
        message: (src: ConversationEvent, args: {}, ctx: AppContext) => FDB.Message.findById(ctx, src.mid!),
        betaMessage: (src: ConversationEvent, args: {}, ctx: AppContext) => FDB.Message.findById(ctx, src.mid!),
    },
    ConversationLostAccess: {
        lostAccess: () => true
    },

    Query: {
        conversationState: withUser(async (ctx, args, uid) => {
            let id = IDs.Conversation.parse(args.id);
            let tail = await FDB.ConversationEvent.createUserStream(id, 1).tail();
            return {
                state: tail
            };
        })
    },

    Subscription: {
        conversationUpdates: {
            resolve: async (msg: any) => {
                return msg;
            },
            subscribe: async function * (r: any, args: GQL.SubscriptionConversationUpdatesArgs, ctx: AppContext) {
                let uid = ctx.auth.uid;
                if (!uid) {
                    throw new AccessDeniedError();
                }
                let chatId = IDs.Conversation.parse(args.conversationId);
                const lostAccessEvent = { cursor: '', items: [{ kind: 'lost_access', seq: -1 }] };

                // Can't trow error, current clients will retry connection in infinite loop
                try {
                    await Modules.Messaging.room.checkAccess(ctx, uid, chatId);
                } catch (e) {
                    while (true) {
                        yield lostAccessEvent;
                        await delay(5000);
                    }
                }

                let generator = FDB.ConversationEvent.createUserLiveStream(ctx, chatId, 20, args.fromState || undefined);
                let haveAccess = true;
                let subscription = EventBus.subscribe(`chat_leave_${chatId}`, (ev: { uid: number, cid: number }) => {
                    if (ev.uid === uid) {
                        haveAccess = false;
                    }
                });

                for await (let event of generator) {
                    if (haveAccess) {
                        yield event;
                    } else {
                        yield lostAccessEvent;
                        subscription.cancel();
                        return;
                    }
                }
            }
        },
    },

    //
    // Deprecated
    //

    ConversationEvent: {
        __resolveType(obj: ConversationEvent) {
            if (obj.kind === 'message_received') {
                return 'ConversationEventMessage';
            } else if (obj.kind === 'message_deleted') {
                return 'ConversationEventDelete';
            } else if (obj.kind === 'message_updated') {
                return 'ConversationEventEditMessage';
            }
            throw Error('Unknown type');
        },
    },
    ConversationEventMessage: {
        message: (src: ConversationEvent, args: {}, ctx: AppContext) => FDB.Message.findById(ctx, src.mid!),
        seq: (src: ConversationEvent) => src.seq
    },
    ConversationEventEditMessage: {
        message: (src: ConversationEvent, args: {}, ctx: AppContext) => FDB.Message.findById(ctx, src.mid!),
        seq: (src: ConversationEvent) => src.seq
    },
    ConversationEventDelete: {
        messageId: (src: ConversationEvent) => IDs.ConversationMessage.serialize(src.mid!),
        seq: (src: ConversationEvent) => src.seq
    },
} as GQLResolver;