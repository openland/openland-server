import { BaseEvent, LiveStreamItem } from '@openland/foundationdb-entity';
import { IDs } from 'openland-module-api/IDs';
import { Store } from 'openland-module-db/FDB';
import {
    UserDialogBumpEvent,
    UserDialogDeletedEvent,
    UserDialogEvent,
    UserDialogMessageDeletedEvent,
    UserDialogMessageReadEvent,
    UserDialogMessageReceivedEvent,
    UserDialogMessageUpdatedEvent,
    UserDialogMuteChangedEvent,
    UserDialogPeerUpdatedEvent,
    UserDialogPhotoUpdatedEvent,
    UserDialogTitleUpdatedEvent
} from 'openland-module-db/store';
import { GQLResolver, GQL } from '../../openland-module-api/schema/SchemaSpec';
import { AppContext } from 'openland-modules/AppContext';
import { buildBaseImageUrl } from 'openland-module-media/ImageRef';
import { withUser } from 'openland-module-api/Resolvers';
import { Modules } from 'openland-modules/Modules';
import { AccessDeniedError } from '../../openland-errors/AccessDeniedError';

export default {
    /* 
     * Dialog Update Containers
     */
    DialogUpdateContainer: {
        __resolveType(obj: LiveStreamItem<BaseEvent>) {
            if (obj.items.length === 1) {
                return 'DialogUpdateSingle';
            } else {
                return 'DialogUpdateBatch';
            }
        }
    },
    DialogUpdateBatch: {
        updates: src => src.items,
        fromSeq: src => 1,
        seq: src => 1,
        state: src => IDs.DialogsUpdatesCursor.serialize(src.cursor || '')
    },
    DialogUpdateSingle: {
        seq: src => 1,
        state: src => IDs.DialogsUpdatesCursor.serialize(src.cursor || ''),
        update: src => src.items[0],
    },
    /*
     * Dialog Updates
     */
    DialogUpdate: {
        __resolveType(obj: BaseEvent) {
            if (obj instanceof UserDialogMessageReceivedEvent) {
                return 'DialogMessageReceived';
            } else if (obj instanceof UserDialogMessageUpdatedEvent) {
                return 'DialogMessageUpdated';
            } else if (obj instanceof UserDialogMessageDeletedEvent) {
                return 'DialogMessageDeleted';
            } else if (obj instanceof UserDialogMessageReadEvent) {
                return 'DialogMessageRead';
            } else if (obj instanceof UserDialogTitleUpdatedEvent) {
                return 'DialogTitleUpdated';
            } else if (obj instanceof UserDialogPhotoUpdatedEvent) {
                return 'DialogPhotoUpdated';
            } else if (obj instanceof UserDialogDeletedEvent) {
                return 'DialogDeleted';
            } else if (obj instanceof UserDialogBumpEvent) {
                return 'DialogBump';
            } else if (obj instanceof UserDialogMuteChangedEvent) {
                return 'DialogMuteChanged';
            } else if (obj instanceof UserDialogPeerUpdatedEvent) {
                return 'DialogPeerUpdated';
            }
            throw Error('Unknown dialog update type: ' + obj.type);
        }
    },
    DialogMessageReceived: {
        cid: src => IDs.Conversation.serialize(src.cid!),
        message: (src, args, ctx) => Store.Message.findById(ctx, src.mid),
        betaMessage: (src, args, ctx) => Store.Message.findById(ctx, src.mid),
        alphaMessage: (src, args, ctx) => Store.Message.findById(ctx, src.mid),
        unread: async (src, args, ctx) => Store.UserDialogCounter.byId(ctx.auth.uid!, src.cid || (await Store.Message.findById(ctx, src.mid!))!.cid).get(ctx),
        globalUnread: async (src, args, ctx) => await Modules.Messaging.fetchUserGlobalCounter(ctx, ctx.auth.uid!),
        haveMention: async (src, args, ctx) => Store.UserDialogHaveMention.byId(ctx.auth.uid!, src.cid || (await Store.Message.findById(ctx, src.mid!))!.cid).get(ctx),
        silent: async (src, args, ctx) => Modules.Messaging.isSilent(ctx, ctx.auth.uid!, src.mid!),
        showNotification: async (src, args, ctx) => Modules.Messaging.isShown(ctx, ctx.auth.uid!, src.mid!)
    },
    DialogMessageUpdated: {
        cid: async (src, args, ctx) => IDs.Conversation.serialize(src.cid || (await Store.Message.findById(ctx, src.mid!))!.cid),
        message: (src, args, ctx) => Store.Message.findById(ctx, src.mid!),
        betaMessage: (src, args, ctx) => Store.Message.findById(ctx, src.mid!),
        alphaMessage: (src, args, ctx) => Store.Message.findById(ctx, src.mid!),
        haveMention: async (src, args, ctx) => Store.UserDialogHaveMention.byId(ctx.auth.uid!, src.cid || (await Store.Message.findById(ctx, src.mid!))!.cid).get(ctx)
    },
    DialogMessageDeleted: {
        cid: async (src, args, ctx) => IDs.Conversation.serialize(src.cid || (await Store.Message.findById(ctx, src.mid!))!.cid),
        message: (src, args, ctx) => Store.Message.findById(ctx, src.mid!),
        betaMessage: (src, args, ctx) => Store.Message.findById(ctx, src.mid!),
        alphaMessage: (src, args, ctx) => Store.Message.findById(ctx, src.mid!),
        alphaPrevMessage: async (src, args, ctx) => {
            return (await Store.Message.chat.query(ctx, src.cid!, { limit: 1, reverse: true })).items[0];
        },
        prevMessage: async (src, args, ctx) => {
            return (await Store.Message.chat.query(ctx, src.cid!, { limit: 1, reverse: true })).items[0];
        },
        unread: async (src, args, ctx) => Store.UserDialogCounter.byId(ctx.auth.uid!, src.cid || (await Store.Message.findById(ctx, src.mid!))!.cid).get(ctx),
        globalUnread: async (src, args, ctx) => await Modules.Messaging.fetchUserGlobalCounter(ctx, ctx.auth.uid!),
        haveMention: async (src, args, ctx) => Store.UserDialogHaveMention.byId(ctx.auth.uid!, src.cid || (await Store.Message.findById(ctx, src.mid!))!.cid).get(ctx)
    },
    DialogMessageRead: {
        cid: (src) => IDs.Conversation.serialize(src.cid!),
        mid: (src) => src.mid && IDs.Message.serialize(src.mid),
        unread: async (src, args, ctx) => Store.UserDialogCounter.byId(ctx.auth.uid!, src.cid || (await Store.Message.findById(ctx, src.mid!))!.cid).get(ctx),
        globalUnread: async (src, args, ctx) => await Modules.Messaging.fetchUserGlobalCounter(ctx, ctx.auth.uid!),
        haveMention: async (src, args, ctx) => Store.UserDialogHaveMention.byId(ctx.auth.uid!, src.cid || (await Store.Message.findById(ctx, src.mid!))!.cid).get(ctx)
    },
    DialogTitleUpdated: {
        cid: (src) => IDs.Conversation.serialize(src.cid!),
        title: (src) => src.title,
    },
    DialogPhotoUpdated: {
        cid: (src) => IDs.Conversation.serialize(src.cid!),
        photo: async (src) => src.photo && buildBaseImageUrl(src.photo),
    },
    DialogDeleted: {
        cid: src => IDs.Conversation.serialize(src.cid!),
        globalUnread: async (src, args, ctx) => await Modules.Messaging.fetchUserGlobalCounter(ctx, ctx.auth.uid!)
    },
    DialogBump: {
        cid: (src) => IDs.Conversation.serialize(src.cid!),
        globalUnread: async (src, args, ctx) => await Modules.Messaging.fetchUserGlobalCounter(ctx, ctx.auth.uid!),
        unread: async (src, args, ctx) => Store.UserDialogCounter.byId(ctx.auth.uid!, src.cid).get(ctx),
        topMessage: async (src, args, ctx) => {
            return (await Store.Message.chat.query(ctx, src.cid!, { limit: 1, reverse: true })).items[0];
        },
        haveMention: async (src, args, ctx) => Store.UserDialogHaveMention.byId(ctx.auth.uid!, src.cid).get(ctx)
    },
    DialogMuteChanged: {
        cid: src => IDs.Conversation.serialize(src.cid!),
        mute: src => src.mute,
        globalUnread: async (src, args, ctx) => await Modules.Messaging.fetchUserGlobalCounter(ctx, ctx.auth.uid!)
    },
    DialogPeerUpdated: {
        cid: src => IDs.Conversation.serialize(src.cid!),
        peer: src => src.cid
    },
    // depricated
    DialogMentionedChanged: {
        cid: (src) => IDs.Conversation.serialize(src.cid!),
        haveMention: async () => false
    },

    Query: {
        dialogsState: withUser(async (ctx, args, uid) => {
            let tail = await Store.UserDialogEventStore.createStream(uid, { batchSize: 1 }).tail(ctx) || '';
            return {
                state: IDs.DialogsUpdatesCursor.serialize(tail)
            };
        })
    },

    /*
     * Subscription
     */
    Subscription: {
        dialogsUpdates: {
            resolve: async (msg: any) => {
                return msg;
            },
            subscribe: async function* (r: any, args: GQL.SubscriptionDialogsUpdatesArgs, ctx: AppContext) {
                if (!ctx.auth.uid) {
                    throw new AccessDeniedError();
                }
                let fromState: string | undefined = undefined;
                let isOldCursor = false;
                if (args.fromState) {
                    try {
                        fromState = IDs.DialogsUpdatesCursor.parse(args.fromState);
                    } catch (e) {
                        isOldCursor = true;
                        // Send old updates
                        let oldZipedGenerator = await Modules.Messaging.zipUpdatesInBatchesAfter(ctx, ctx.auth.uid!, args.fromState || undefined);
                        let oldEvents: UserDialogEvent[] = [];
                        for await (let event of oldZipedGenerator) {
                            oldEvents.push(...event.items);
                        }
                        let converted = oldEvents
                            .map(event => {
                                if (event.kind === 'message_received') {
                                    return UserDialogMessageReceivedEvent.create({
                                        uid: event.uid,
                                        cid: event.cid!,
                                        mid: event.mid!,
                                    });
                                } else if (event.kind === 'message_updated') {
                                    return UserDialogMessageUpdatedEvent.create({
                                        uid: event.uid,
                                        cid: event.cid!,
                                        mid: event.mid!
                                    });
                                } else if (event.kind === 'message_deleted') {
                                    return UserDialogMessageDeletedEvent.create({
                                        uid: event.uid,
                                        cid: event.cid!,
                                        mid: event.mid!
                                    });
                                } else if (event.kind === 'message_read') {
                                    return UserDialogMessageReadEvent.create({
                                        uid: event.uid,
                                        cid: event.cid!,
                                        mid: event.mid
                                    });
                                } else if (event.kind === 'title_updated') {
                                    return UserDialogTitleUpdatedEvent.create({
                                        uid: event.uid,
                                        cid: event.cid!,
                                        title: event.title!
                                    });
                                } else if (event.kind === 'dialog_deleted') {
                                    return UserDialogDeletedEvent.create({
                                        uid: event.uid,
                                        cid: event.cid!,
                                    });
                                } else if (event.kind === 'dialog_bump') {
                                    return UserDialogBumpEvent.create({
                                        uid: event.uid,
                                        cid: event.cid!,
                                    });
                                } else if (event.kind === 'photo_updated') {
                                    return UserDialogPhotoUpdatedEvent.create({
                                        uid: event.uid,
                                        cid: event.cid!,
                                        photo: event.photo
                                    });
                                } else if (event.kind === 'dialog_mute_changed') {
                                    return UserDialogMuteChangedEvent.create({
                                        uid: event.uid,
                                        cid: event.cid!,
                                        mute: event.mute!
                                    });
                                }
                                return null;
                            })
                            .filter(event => !!event);

                        yield { items: converted, cursor: '' };
                    }
                }

                if (isOldCursor) {
                    fromState = await Store.UserDialogEventStore.createStream(ctx.auth.uid!).head(ctx) || undefined;
                }
                let zipedGenerator = await Modules.Messaging.zipUpdatesInBatchesAfterModern(ctx, ctx.auth.uid!, fromState);
                let subscribeAfter = fromState || null;
                for await (let event of zipedGenerator) {
                    subscribeAfter = event.cursor;
                    yield event;
                }
                let stream = Store.UserDialogEventStore.createLiveStream(ctx, ctx.auth.uid!, { batchSize: 20, after: subscribeAfter || undefined });
                for await (let event of stream) {
                    yield event;
                }
            }
        },
    }
} as GQLResolver;