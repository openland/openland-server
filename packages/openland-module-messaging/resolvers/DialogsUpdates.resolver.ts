import { Context } from '@openland/context';
import { BaseEvent, LiveStreamItem } from '@openland/foundationdb-entity';
import { IDs } from 'openland-module-api/IDs';
import { Store } from 'openland-module-db/FDB';
import {
    UserDialogBumpEvent, UserDialogCallStateChangedEvent,
    UserDialogDeletedEvent, UserDialogGotAccessEvent, UserDialogLostAccessEvent,
    UserDialogMessageDeletedEvent,
    UserDialogMessageReadEvent,
    UserDialogMessageReceivedEvent,
    UserDialogMessageUpdatedEvent,
    UserDialogMuteChangedEvent,
    UserDialogPeerUpdatedEvent,
    UserDialogPhotoUpdatedEvent,
    UserDialogTitleUpdatedEvent,
} from 'openland-module-db/store';
import { GQLResolver, GQL } from '../../openland-module-api/schema/SchemaSpec';
import { buildBaseImageUrl } from 'openland-module-media/ImageRef';
import { withUser } from 'openland-module-api/Resolvers';
import { Modules } from 'openland-modules/Modules';
import { AccessDeniedError } from '../../openland-errors/AccessDeniedError';

export const Resolver: GQLResolver = {
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
            } else if (obj instanceof UserDialogCallStateChangedEvent) {
                return 'DialogCallStateChanged';
            } else if (obj instanceof UserDialogGotAccessEvent) {
                return 'DialogGotAccess';
            } else if (obj instanceof UserDialogLostAccessEvent) {
                return 'DialogLostAccess';
            }
            throw Error('Unknown dialog update type: ' + obj.type);
        }
    },
    DialogMessageReceived: {
        cid: src => IDs.Conversation.serialize(src.cid!),
        message: async (src, args, ctx) => (await Store.Message.findById(ctx, src.mid))!,
        betaMessage: async (src, args, ctx) => (await Store.Message.findById(ctx, src.mid))!,
        alphaMessage: async (src, args, ctx) => (await Store.Message.findById(ctx, src.mid))!,
        unread: async (src, args, ctx) => Modules.Messaging.counters.fetchUserUnreadInChat(ctx, src.uid, src.cid),
        globalUnread: async (src, args, ctx) => await Modules.Messaging.counters.fetchUserGlobalCounter(ctx, ctx.auth.uid!),
        haveMention: async (src, args, ctx) => Modules.Messaging.counters.fetchUserMentionedInChat(ctx, src.uid, src.cid),
        silent: async (src, args, ctx) => Modules.Messaging.isSilent(ctx, ctx.auth.uid!, src.mid!),
        showNotification: async (src, args, ctx) => Modules.Messaging.isShown(ctx, ctx.auth.uid!, src.mid!),
        membership: async (src, args, ctx) => ctx.auth.uid ? await Modules.Messaging.room.resolveUserMembershipStatus(ctx, ctx.auth.uid, src.cid) : 'none'
    },
    DialogMessageUpdated: {
        cid: async (src, args, ctx) => IDs.Conversation.serialize(src.cid || (await Store.Message.findById(ctx, src.mid!))!.cid),
        message: async (src, args, ctx) => (await Store.Message.findById(ctx, src.mid))!,
        betaMessage: async (src, args, ctx) => (await Store.Message.findById(ctx, src.mid))!,
        alphaMessage: async (src, args, ctx) => (await Store.Message.findById(ctx, src.mid))!,
        haveMention: async (src, args, ctx) => Modules.Messaging.counters.fetchUserMentionedInChat(ctx, src.uid, src.cid)
    },
    DialogMessageDeleted: {
        cid: async (src, args, ctx) => IDs.Conversation.serialize(src.cid || (await Store.Message.findById(ctx, src.mid!))!.cid),
        message: async (src, args, ctx) => (await Store.Message.findById(ctx, src.mid))!,
        betaMessage: async (src, args, ctx) => (await Store.Message.findById(ctx, src.mid))!,
        alphaMessage: async (src, args, ctx) => (await Store.Message.findById(ctx, src.mid))!,
        alphaPrevMessage: async (src, args, ctx) => {
            return await Modules.Messaging.findTopMessage(ctx, src.cid!, ctx.auth.uid!);
        },
        prevMessage: async (src, args, ctx) => {
            return await Modules.Messaging.findTopMessage(ctx, src.cid!, ctx.auth.uid!);
        },
        unread: async (src, args, ctx) => Modules.Messaging.counters.fetchUserUnreadInChat(ctx, src.uid, src.cid),
        globalUnread: async (src, args, ctx) => await Modules.Messaging.counters.fetchUserGlobalCounter(ctx, ctx.auth.uid!),
        haveMention: async (src, args, ctx) => Modules.Messaging.counters.fetchUserMentionedInChat(ctx, src.uid, src.cid)
    },
    DialogMessageRead: {
        cid: (src) => IDs.Conversation.serialize(src.cid!),
        mid: (src) => src.mid ? IDs.Message.serialize(src.mid) : null,
        unread: async (src, args, ctx) => Modules.Messaging.counters.fetchUserUnreadInChat(ctx, src.uid, src.cid),
        globalUnread: async (src, args, ctx) => await Modules.Messaging.counters.fetchUserGlobalCounter(ctx, ctx.auth.uid!),
        haveMention: async (src, args, ctx) => Modules.Messaging.counters.fetchUserMentionedInChat(ctx, src.uid, src.cid)
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
        globalUnread: async (src, args, ctx) => await Modules.Messaging.counters.fetchUserGlobalCounter(ctx, ctx.auth.uid!)
    },
    DialogBump: {
        cid: (src) => IDs.Conversation.serialize(src.cid!),
        globalUnread: async (src, args, ctx) => await Modules.Messaging.counters.fetchUserGlobalCounter(ctx, ctx.auth.uid!),
        unread: async (src, args, ctx) => Modules.Messaging.counters.fetchUserUnreadInChat(ctx, src.uid, src.cid),
        topMessage: async (src, args, ctx) => {
            return (await Store.Message.chat.query(ctx, src.cid!, { limit: 1, reverse: true })).items[0];
        },
        haveMention: async (src, args, ctx) => Modules.Messaging.counters.fetchUserMentionedInChat(ctx, src.uid, src.cid),
        membership: async (src, args, ctx) => ctx.auth.uid ? await Modules.Messaging.room.resolveUserMembershipStatus(ctx, ctx.auth.uid, src.cid) : 'none'
    },
    DialogMuteChanged: {
        cid: src => IDs.Conversation.serialize(src.cid!),
        mute: src => src.mute || false,
        globalUnread: async (src, args, ctx) => await Modules.Messaging.counters.fetchUserGlobalCounter(ctx, ctx.auth.uid!)
    },
    DialogPeerUpdated: {
        cid: src => IDs.Conversation.serialize(src.cid!),
        peer: src => src.cid
    },
    DialogCallStateChanged: {
        hasActiveCall: src => src.hasActiveCall,
        cid: src => IDs.Conversation.serialize(src.cid),
    },
    DialogGotAccess: {
        cid: src => IDs.Conversation.serialize(src.cid),
    },
    DialogLostAccess: {
        cid: src => IDs.Conversation.serialize(src.cid),
    },
    // deprecated
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
            subscribe: async function* (r: any, args: GQL.SubscriptionDialogsUpdatesArgs, ctx: Context) {
                if (!ctx.auth.uid) {
                    throw new AccessDeniedError();
                }
                let fromState: string | undefined = undefined;
                let isOldCursor = false;
                if (args.fromState) {
                    fromState = IDs.DialogsUpdatesCursor.parse(args.fromState);
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
};
