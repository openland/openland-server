import { MessageDeletedEvent, ChatUpdatedEvent } from './../../openland-module-db/store';
import { GQL, GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
import { GQLRoots } from '../../openland-module-api/schema/SchemaRoots';
import ChatUpdateContainerRoot = GQLRoots.ChatUpdateContainerRoot;
import { Store } from '../../openland-module-db/FDB';
import { withUser } from '../../openland-module-api/Resolvers';
import { IDs } from '../../openland-module-api/IDs';
import { AccessDeniedError } from '../../openland-errors/AccessDeniedError';
import { Modules } from '../../openland-modules/Modules';
import { delay } from '../../openland-utils/timer';
import { EventBus } from '../../openland-module-pubsub/EventBus';
import { AppContext } from '../../openland-modules/AppContext';
import { BaseEvent } from '@openland/foundationdb-entity';
import { MessageReceivedEvent, MessageUpdatedEvent } from 'openland-module-db/store';

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
        seq: src => 1,
        state: src => src.cursor ? IDs.ChatUpdatesCursor.serialize(src.cursor) : null,
        update: src => src.items[0],
    },
    ChatUpdateBatch: {
        updates: src => src.items,
        fromSeq: src => 1,
        seq: src => 1,
        state: src => src.cursor ? IDs.ChatUpdatesCursor.serialize(src.cursor) : null
    },

    ChatUpdate: {
        __resolveType(obj: BaseEvent) {
            if (obj instanceof MessageReceivedEvent) {
                return 'ChatMessageReceived';
            } else if (obj instanceof MessageUpdatedEvent) {
                return 'ChatMessageUpdated';
            } else if (obj instanceof MessageDeletedEvent) {
                return 'ChatMessageDeleted';
            } else if (obj instanceof ChatUpdatedEvent) {
                return 'ChatUpdated';
            } else {
                return 'ChatLostAccess';
            }
        }
    },

    ChatUpdated: {
        chat: src => (src as ChatUpdatedEvent).cid,
        by: src => (src as ChatUpdatedEvent).uid
    },
    ChatMessageReceived: {
        message: (src, args, ctx) => Store.Message.findById(ctx, (src as MessageReceivedEvent).mid),
        repeatKey: async (src, args, ctx) => {
            let msg = await Store.Message.findById(ctx, (src as MessageReceivedEvent).mid);
            if (msg) {
                return msg.repeatKey;
            }
            return null;
        }
    },
    ChatMessageUpdated: {
        message: (src, args, ctx) => Store.Message.findById(ctx, (src as MessageUpdatedEvent).mid),
    },
    ChatMessageDeleted: {
        message: (src, args, ctx) => Store.Message.findById(ctx, (src as MessageDeletedEvent).mid!),
    },
    ChatLostAccess: {
        lostAccess: () => true
    },

    Query: {
        chatState: withUser(async (ctx, args, uid) => {
            let id = IDs.Conversation.parse(args.chatId);
            let tail = await Store.ConversationEventStore.createStream(id, { batchSize: 1 }).tail(ctx) || '';
            return {
                state: IDs.ChatUpdatesCursor.serialize(tail)
            };
        }),
        conversationState: withUser(async (ctx, args, uid) => {
            let id = IDs.Conversation.parse(args.id);
            let tail = await Store.ConversationEventStore.createStream(id, { batchSize: 1 }).tail(ctx) || '';
            return {
                state: IDs.ChatUpdatesCursor.serialize(tail)
            };
        })
    },

    Subscription: {
        chatUpdates: {
            resolve: async msg => {
                return msg;
            },
            subscribe: async function* (r: any, args: GQL.SubscriptionChatUpdatesArgs, ctx: AppContext) {
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

                // Fallback cursor
                let after: string | null = null;
                if (args.fromState) {
                    try {
                        after = IDs.ChatUpdatesCursor.parse(args.fromState);
                    } catch (e) {
                        let oldEvents = await Store.ConversationEvent.user.query(ctx, chatId, {
                            afterCursor: args.fromState
                        });
                        if (oldEvents.items.length > 0) {
                            let events: BaseEvent[] = [];
                            for (let e of oldEvents.items) {
                                if (e.kind === 'chat_updated') {
                                    events.push(ChatUpdatedEvent.create({
                                        cid: e.cid,
                                        uid: e.uid!
                                    }));
                                } else if (e.kind === 'message_received') {
                                    events.push(MessageReceivedEvent.create({
                                        cid: e.cid,
                                        mid: e.mid!
                                    }));
                                } else if (e.kind === 'message_updated') {
                                    events.push(MessageUpdatedEvent.create({
                                        cid: e.cid,
                                        mid: e.mid!
                                    }));
                                } else if (e.kind === 'message_deleted') {
                                    events.push(MessageDeletedEvent.create({
                                        cid: e.cid,
                                        mid: e.mid!
                                    }));
                                }
                            }
                            yield {
                                items: events,
                                cursor: '' /* Start of stream */
                            };
                        }
                    }
                }

                // New event source
                let generator = Store.ConversationEventStore.createLiveStream(ctx, chatId, { batchSize: 20, after: after || undefined });
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