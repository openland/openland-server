import { Context } from '@openland/context';
import { MessageDeletedEvent, ChatUpdatedEvent, ChatLostAccess } from './../../openland-module-db/store';
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
import { BaseEvent } from '@openland/foundationdb-entity';
import { MessageReceivedEvent, MessageUpdatedEvent } from 'openland-module-db/store';
import { isContextCancelled, onContextCancel } from '@openland/lifetime';
import { batch } from '../../openland-utils/batch';

function eventCollapseKey(obj: BaseEvent) {
    if (obj instanceof MessageUpdatedEvent) {
        return `message_updated_${obj.mid}`;
    } if (obj instanceof ChatUpdatedEvent) {
        return `chat_updated`;
    } else {
        return null;
    }
}

function collapseEvents(events: BaseEvent[]) {
    let seenEvents = new Set();
    let res = [];

    for (let i = events.length - 1; i >= 0; i--) {
        let event = events[i];

        let key = eventCollapseKey(event);
        if (key === null) {
            res.unshift(event);
            continue;
        }
        if (seenEvents.has(key)) {
            continue;
        }
        seenEvents.add(key);
        res.unshift(event);
    }

    return res;
}

export const Resolver: GQLResolver = {
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
        state: src => IDs.ChatUpdatesCursor.serialize(src.cursor || ''),
        update: src => src.items[0],
    },
    ChatUpdateBatch: {
        updates: src => src.items,
        fromSeq: src => 1,
        seq: src => 1,
        state: src => IDs.ChatUpdatesCursor.serialize(src.cursor || '')
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
        message: async (src, args, ctx) => (await Store.Message.findById(ctx, src.mid))!,
        repeatKey: async (src, args, ctx) => {
            let msg = await Store.Message.findById(ctx, src.mid);
            if (msg) {
                return msg.repeatKey;
            }
            return null;
        }
    },
    ChatMessageUpdated: {
        message: async (src, args, ctx) => (await Store.Message.findById(ctx, src.mid))!,
    },
    ChatMessageDeleted: {
        message: async (src, args, ctx) => (await Store.Message.findById(ctx, src.mid))!,
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
                return Store.ConversationEventStore.decodeRawLiveStreamItem(msg);
            },
            subscribe: async function* (r: any, args: GQL.SubscriptionChatUpdatesArgs, ctx: Context) {
                if (!ctx.auth.uid) {
                    throw new AccessDeniedError();
                }
                let uid = ctx.auth.uid;
                if (!uid) {
                    throw new AccessDeniedError();
                }
                let chatId = IDs.Conversation.parse(args.chatId);
                const lostAccessEvent = Store.ConversationEventStore.encodeRawLiveStreamItem({ cursor: '', items: [ChatLostAccess.create({ cid: chatId })] } as any);

                // Can't trow error, current clients will retry connection in infinite loop
                try {
                    await Modules.Messaging.room.checkAccess(ctx, uid, chatId);
                } catch (e) {
                    yield lostAccessEvent;
                    while (!isContextCancelled(ctx)) {
                        await delay(5000);
                    }
                    return;
                }

                // Fallback cursor
                let after: string | null = null;
                if (args.fromState) {
                    after = IDs.ChatUpdatesCursor.parse(args.fromState);
                }

                // Fetch old events
                if (after) {
                    let oldEvents: BaseEvent[] = [];
                    let stream = Store.ConversationEventStore.createStream(chatId, { batchSize: 100, after });
                    // Read all old events
                    while (true) {
                        let res = await stream.next(ctx);
                        if (res.length === 0) {
                            break;
                        }

                        oldEvents.push(...res);
                    }

                    let collapsedEvents = collapseEvents(oldEvents);

                    for (let b of batch(collapsedEvents, 20)) {
                        yield Store.ConversationEventStore.encodeRawLiveStreamItem({
                            items: b,
                            cursor: stream.cursor
                        });
                        await delay(100);
                    }

                    after = stream.cursor;
                }

                // New event source
                let generator = Store.ConversationEventStore.createLiveStream(ctx, chatId, { batchSize: 20, after: after || undefined });
                let haveAccess = true;
                let subscription = EventBus.subscribe('default', `chat_leave_${chatId}`, (ev: { uid: number, cid: number }) => {
                    if (ev.uid === uid) {
                        haveAccess = false;
                    }
                });
                if (isContextCancelled(ctx)) {
                    subscription.cancel();
                    return;
                }
                onContextCancel(ctx, () => {
                    subscription.cancel();
                });

                for await (let event of generator) {
                    if (!haveAccess) {
                        subscription.cancel();
                        yield lostAccessEvent;
                        while (!isContextCancelled(ctx)) {
                            await delay(5000);
                        }
                        return;
                    }

                    let events: BaseEvent[] = [];
                    for (let ev of event.items) {
                        if (
                            ev instanceof MessageReceivedEvent ||
                            ev instanceof MessageUpdatedEvent ||
                            ev instanceof MessageDeletedEvent
                        ) {
                            if (ev.visibleOnlyForUids && ev.visibleOnlyForUids.length > 0 && !ev.visibleOnlyForUids.includes(uid)) {
                                continue;
                            }
                        }
                        events.push(ev);
                    }
                    yield Store.ConversationEventStore.encodeRawLiveStreamItem({
                        items: collapseEvents(events),
                        cursor: event.cursor
                    });
                }
            }
        },
    },
};
