import { IDs } from 'openland-module-api/IDs';
import { FDB } from 'openland-module-db/FDB';
import { FLiveStreamItem } from 'foundation-orm/FLiveStreamItem';
import { UserDialogEvent } from 'openland-module-db/schema';
import { GQLResolver, GQL } from '../../openland-module-api/schema/SchemaSpec';
import { AppContext } from 'openland-modules/AppContext';
import { buildBaseImageUrl } from 'openland-module-media/ImageRef';
import { withUser } from 'openland-module-api/Resolvers';
import { Modules } from 'openland-modules/Modules';

export default {
    /* 
     * Dialog Update Containers
     */
    DialogUpdateContainer: {
        __resolveType(obj: FLiveStreamItem<UserDialogEvent>) {
            if (obj.items.length === 1) {
                return 'DialogUpdateSingle';
            } else {
                return 'DialogUpdateBatch';
            }
        }
    },
    DialogUpdateBatch: {
        updates: (src: FLiveStreamItem<UserDialogEvent>) => src.items,
        fromSeq: (src: FLiveStreamItem<UserDialogEvent>) => (src as any).fromSeq || src.items[0].seq,
        seq: (src: FLiveStreamItem<UserDialogEvent>) => src.items[src.items.length - 1].seq,
        state: (src: FLiveStreamItem<UserDialogEvent>) => src.cursor
    },
    DialogUpdateSingle: {
        seq: (src: FLiveStreamItem<UserDialogEvent>) => src.items[0].seq,
        state: (src: FLiveStreamItem<UserDialogEvent>) => src.cursor,
        update: (src: FLiveStreamItem<UserDialogEvent>) => src.items[0],
    },
    /*
     * Dialog Updates
     */
    DialogUpdate: {
        __resolveType(obj: UserDialogEvent) {
            if (obj.kind === 'message_received') {
                return 'DialogMessageReceived';
            } else if (obj.kind === 'message_updated') {
                return 'DialogMessageUpdated';
            } else if (obj.kind === 'message_deleted') {
                return 'DialogMessageDeleted';
            } else if (obj.kind === 'message_read') {
                return 'DialogMessageRead';
            } else if (obj.kind === 'title_updated') {
                return 'DialogTitleUpdated';
            } else if (obj.kind === 'photo_updated') {
                return 'DialogPhotoUpdated';
            } else if (obj.kind === 'dialog_deleted') {
                return 'DialogDeleted';
            } else if (obj.kind === 'dialog_bump') {
                return 'DialogBump';
            } else if (obj.kind === 'dialog_mute_changed') {
                return 'DialogMuteChanged';
            } else if (obj.kind === 'dialog_mentioned_changed') {
                return 'DialogMentionedChanged';
            }
            throw Error('Unknown dialog update type: ' + obj.kind);
        }
    },
    DialogMessageReceived: {
        cid: (src: UserDialogEvent) => IDs.Conversation.serialize(src.cid!),
        message: (src: UserDialogEvent, args: {}, ctx: AppContext) => FDB.Message.findById(ctx, src.mid!),
        betaMessage: (src: UserDialogEvent, args: {}, ctx: AppContext) => FDB.Message.findById(ctx, src.mid!),
        alphaMessage: (src: UserDialogEvent, args: {}, ctx: AppContext) => FDB.Message.findById(ctx, src.mid!),
        unread: async (src: UserDialogEvent, args: {}, ctx: AppContext) => FDB.UserDialogCounter.byId(ctx.auth.uid!, src.cid || (await FDB.Message.findById(ctx, src.mid!))!.cid).get(ctx),
        globalUnread: async (src: UserDialogEvent, args: {}, ctx: AppContext) => FDB.UserCounter.byId(ctx.auth.uid!).get(ctx),
        haveMention: (src: UserDialogEvent) => src.haveMention || false
    },
    DialogMessageUpdated: {
        cid: async (src: UserDialogEvent, args: {}, ctx: AppContext) => IDs.Conversation.serialize(src.cid || (await FDB.Message.findById(ctx, src.mid!))!.cid),
        message: (src: UserDialogEvent, args: {}, ctx: AppContext) => FDB.Message.findById(ctx, src.mid!),
        betaMessage: (src: UserDialogEvent, args: {}, ctx: AppContext) => FDB.Message.findById(ctx, src.mid!),
        alphaMessage: (src: UserDialogEvent, args: {}, ctx: AppContext) => FDB.Message.findById(ctx, src.mid!),
        haveMention: (src: UserDialogEvent) => src.haveMention || false
    },
    DialogMessageDeleted: {
        cid: async (src: UserDialogEvent, args: {}, ctx: AppContext) => IDs.Conversation.serialize(src.cid || (await FDB.Message.findById(ctx, src.mid!))!.cid),
        message: (src: UserDialogEvent, args: {}, ctx: AppContext) => FDB.Message.findById(ctx, src.mid!),
        betaMessage: (src: UserDialogEvent, args: {}, ctx: AppContext) => FDB.Message.findById(ctx, src.mid!),
        alphaMessage: (src: UserDialogEvent, args: {}, ctx: AppContext) => FDB.Message.findById(ctx, src.mid!),
        alphaPrevMessage: async (src: UserDialogEvent, args: {}, ctx: AppContext) => {
            return (await FDB.Message.rangeFromChat(ctx, src.cid!, 1, true))[0];
        },
        prevMessage: async (src: UserDialogEvent, args: {}, ctx: AppContext) => {
            return (await FDB.Message.rangeFromChat(ctx, src.cid!, 1, true))[0];
        },
        unread: async (src: UserDialogEvent, args: {}, ctx: AppContext) => FDB.UserDialogCounter.byId(ctx.auth.uid!, src.cid || (await FDB.Message.findById(ctx, src.mid!))!.cid).get(ctx),
        globalUnread: async (src: UserDialogEvent, args: {}, ctx: AppContext) => FDB.UserCounter.byId(ctx.auth.uid!).get(ctx),
        haveMention: (src: UserDialogEvent) => src.haveMention || false
    },
    DialogMessageRead: {
        cid: (src: UserDialogEvent) => IDs.Conversation.serialize(src.cid!),
        unread: async (src: UserDialogEvent, args: {}, ctx: AppContext) => FDB.UserDialogCounter.byId(ctx.auth.uid!, src.cid || (await FDB.Message.findById(ctx, src.mid!))!.cid).get(ctx),
        globalUnread: async (src: UserDialogEvent, args: {}, ctx: AppContext) => FDB.UserCounter.byId(ctx.auth.uid!).get(ctx),
        haveMention: (src: UserDialogEvent) => src.haveMention || false
    },
    DialogTitleUpdated: {
        cid: (src: UserDialogEvent) => IDs.Conversation.serialize(src.cid!),
        title: (src: UserDialogEvent) => src.title,
    },
    DialogPhotoUpdated: {
        cid: (src: UserDialogEvent) => IDs.Conversation.serialize(src.cid!),
        photo: async (src: UserDialogEvent) => src.photo && buildBaseImageUrl(src.photo),
    },
    DialogDeleted: {
        cid: src => IDs.Conversation.serialize(src.cid!),
        globalUnread: async (src: UserDialogEvent, args: {}, ctx: AppContext) => FDB.UserCounter.byId(ctx.auth.uid!).get(ctx)
    },
    DialogBump: {
        cid: (src: UserDialogEvent) => IDs.Conversation.serialize(src.cid!),
        globalUnread: async (src: UserDialogEvent, args: {}, ctx: AppContext) => FDB.UserCounter.byId(ctx.auth.uid!).get(ctx),
        unread: async (src: UserDialogEvent, args: {}, ctx: AppContext) => FDB.UserDialogCounter.byId(ctx.auth.uid!, src.cid || (await FDB.Message.findById(ctx, src.mid!))!.cid).get(ctx),
        topMessage: async (src: UserDialogEvent, args: {}, ctx: AppContext) => {
            return (await FDB.Message.rangeFromChat(ctx, src.cid!, 1, true))[0];
        },
        haveMention: (src: UserDialogEvent) => src.haveMention || false
    },
    DialogMuteChanged: {
        cid: src => IDs.Conversation.serialize(src.cid!),
        mute: src => src.mute,
        globalUnread: async (src: UserDialogEvent, args: {}, ctx: AppContext) => FDB.UserCounter.byId(ctx.auth.uid!).get(ctx)
    },
    // depricated
    DialogMentionedChanged: {
        cid: (src: UserDialogEvent) => IDs.Conversation.serialize(src.cid!),
        haveMention: (src: UserDialogEvent) => src.haveMention || false,
    },

    Query: {
        dialogsState: withUser(async (ctx, args, uid) => {
            let tail = await FDB.UserDialogEvent.createUserStream(ctx, uid, 1).tail();
            return {
                state: tail
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
                // zip previous updates in batches
                let zipedGenerator = await Modules.Messaging.zipUpdatesInBatchesAfter(ctx, ctx.auth.uid!, args.fromState || undefined);
                let subscribeAfter = args.fromState || undefined;
                for await (let event of zipedGenerator) {
                    subscribeAfter = event.cursor;
                    yield event;
                }
                if (!subscribeAfter) {
                    subscribeAfter = await FDB.UserDialogEvent.createUserStream(ctx, ctx.auth.uid!, 1).tail();
                }

                // start subscription from last known event
                let generator = FDB.UserDialogEvent.createUserLiveStream(ctx, ctx.auth.uid!, 20, subscribeAfter);
                for await (let event of generator) {
                    yield event;
                }
            }
        },
    }
} as GQLResolver;