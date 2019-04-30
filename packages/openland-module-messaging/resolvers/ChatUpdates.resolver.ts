import { GQL, GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
import { ConversationEvent } from '../../openland-module-db/schema';
import { GQLRoots } from '../../openland-module-api/schema/SchemaRoots';
import ChatUpdateContainerRoot = GQLRoots.ChatUpdateContainerRoot;
import { FDB } from '../../openland-module-db/FDB';
import { withUser } from '../../openland-module-api/Resolvers';
import { IDs } from '../../openland-module-api/IDs';
import { AccessDeniedError } from '../../openland-errors/AccessDeniedError';
import { Modules } from '../../openland-modules/Modules';
import { delay } from '../../openland-utils/timer';
import { EventBus } from '../../openland-module-pubsub/EventBus';
import { AppContext } from '../../openland-modules/AppContext';

export default {
    ChatUpdateContainer: {
        __resolveType(obj: ChatUpdateContainerRoot) {
            if (obj.items.length === 1) {
                return 'ChatUpdateSingle';
            } else {
                return 'ChatUpdateBatch';
            }
        }
    },
    ChatUpdateSingle: {
        seq: src => src.items[0].seq,
        state: src => src.cursor,
        update: src => src.items[0],
    },
    ChatUpdateBatch: {
        updates: src => src.items,
        fromSeq: src => src.items[0].seq,
        seq: src => src.items[src.items.length - 1].seq,
        state: src => src.cursor
    },

    ChatUpdate: {
        __resolveType(obj: ConversationEvent) {
            if (obj.kind === 'message_received') {
                return 'ChatMessageReceived';
            } else if (obj.kind === 'message_updated') {
                return 'ChatMessageUpdated';
            } else if (obj.kind === 'message_deleted') {
                return 'ChatMessageDeleted';
            }  else if (obj.kind === 'chat_updated') {
                return 'ChatUpdated';
            } else if (obj.kind === 'lost_access') {
                return 'ChatLostAccess';
            }
            throw Error('Unknown chat update type: ' + obj.kind);
        }
    },

    ChatUpdated: {
        chat: src => src.cid,
        by: src => src.uid
    },
    ChatMessageReceived: {
        message: (src, args, ctx) => FDB.Message.findById(ctx, src.mid!),
        repeatKey: async (src, args, ctx) => {
            let msg = await FDB.Message.findById(ctx, src.mid!);
            if (msg) {
                return msg.repeatKey;
            }
            return null;
        }
    },
    ChatMessageUpdated: {
        message: (src, args, ctx) => FDB.Message.findById(ctx, src.mid!),
    },
    ChatMessageDeleted: {
        message: (src, args, ctx) => FDB.Message.findById(ctx, src.mid!),
    },
    ChatLostAccess: {
        lostAccess: () => true
    },

    Query: {
        chatState: withUser(async (ctx, args, uid) => {
            let id = IDs.Conversation.parse(args.chatId);
            let tail = await FDB.ConversationEvent.createUserStream(ctx, id, 1).tail();
            return {
                state: tail
            };
        })
    },

    Subscription: {
        chatUpdates: {
            resolve: async msg => {
                return msg;
            },
            subscribe: async function * (r: any, args: GQL.SubscriptionChatUpdatesArgs, ctx: AppContext) {
                let uid = ctx.auth.uid;
                if (!uid) {
                    throw new AccessDeniedError();
                }
                let chatId = IDs.Conversation.parse(args.chatId);
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
} as GQLResolver;