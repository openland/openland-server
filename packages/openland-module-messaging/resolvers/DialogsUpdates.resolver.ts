import { LiveStreamItem } from '@openland/foundationdb-entity';
import { IDs } from 'openland-module-api/IDs';
import { Store } from 'openland-module-db/FDB';
import { UserDialogEvent } from 'openland-module-db/store';
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
        __resolveType(obj: LiveStreamItem<UserDialogEvent>) {
            if (obj.items.length === 1) {
                return 'DialogUpdateSingle';
            } else {
                return 'DialogUpdateBatch';
            }
        }
    },
    DialogUpdateBatch: {
        updates: (src: LiveStreamItem<UserDialogEvent>) => src.items,
        fromSeq: (src: LiveStreamItem<UserDialogEvent>) => 1,
        seq: (src: LiveStreamItem<UserDialogEvent>) => 1,
        state: (src: LiveStreamItem<UserDialogEvent>) => src.cursor
    },
    DialogUpdateSingle: {
        seq: (src: LiveStreamItem<UserDialogEvent>) => 1,
        state: (src: LiveStreamItem<UserDialogEvent>) => src.cursor,
        update: (src: LiveStreamItem<UserDialogEvent>) => src.items[0],
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
        message: (src: UserDialogEvent, args: {}, ctx: AppContext) => Store.Message.findById(ctx, src.mid!),
        betaMessage: (src: UserDialogEvent, args: {}, ctx: AppContext) => Store.Message.findById(ctx, src.mid!),
        alphaMessage: (src: UserDialogEvent, args: {}, ctx: AppContext) => Store.Message.findById(ctx, src.mid!),
        unread: async (src: UserDialogEvent, args: {}, ctx: AppContext) => Store.UserDialogCounter.byId(ctx.auth.uid!, src.cid || (await Store.Message.findById(ctx, src.mid!))!.cid).get(ctx),
        globalUnread: async (src: UserDialogEvent, args: {}, ctx: AppContext) => await Modules.Messaging.fetchUserGlobalCounter(ctx, ctx.auth.uid!),
        haveMention: async (src: UserDialogEvent, args: {}, ctx: AppContext) => Store.UserDialogHaveMention.byId(ctx.auth.uid!, src.cid || (await Store.Message.findById(ctx, src.mid!))!.cid).get(ctx)
    },
    DialogMessageUpdated: {
        cid: async (src: UserDialogEvent, args: {}, ctx: AppContext) => IDs.Conversation.serialize(src.cid || (await Store.Message.findById(ctx, src.mid!))!.cid),
        message: (src: UserDialogEvent, args: {}, ctx: AppContext) => Store.Message.findById(ctx, src.mid!),
        betaMessage: (src: UserDialogEvent, args: {}, ctx: AppContext) => Store.Message.findById(ctx, src.mid!),
        alphaMessage: (src: UserDialogEvent, args: {}, ctx: AppContext) => Store.Message.findById(ctx, src.mid!),
        haveMention: async (src: UserDialogEvent, args: {}, ctx: AppContext) => Store.UserDialogHaveMention.byId(ctx.auth.uid!, src.cid || (await Store.Message.findById(ctx, src.mid!))!.cid).get(ctx)
    },
    DialogMessageDeleted: {
        cid: async (src: UserDialogEvent, args: {}, ctx: AppContext) => IDs.Conversation.serialize(src.cid || (await Store.Message.findById(ctx, src.mid!))!.cid),
        message: (src: UserDialogEvent, args: {}, ctx: AppContext) => Store.Message.findById(ctx, src.mid!),
        betaMessage: (src: UserDialogEvent, args: {}, ctx: AppContext) => Store.Message.findById(ctx, src.mid!),
        alphaMessage: (src: UserDialogEvent, args: {}, ctx: AppContext) => Store.Message.findById(ctx, src.mid!),
        alphaPrevMessage: async (src: UserDialogEvent, args: {}, ctx: AppContext) => {
            return (await Store.Message.chat.query(ctx, src.cid!, { limit: 1, reverse: true })).items[0];
        },
        prevMessage: async (src: UserDialogEvent, args: {}, ctx: AppContext) => {
            return (await Store.Message.chat.query(ctx, src.cid!, { limit: 1, reverse: true })).items[0];
        },
        unread: async (src: UserDialogEvent, args: {}, ctx: AppContext) => Store.UserDialogCounter.byId(ctx.auth.uid!, src.cid || (await Store.Message.findById(ctx, src.mid!))!.cid).get(ctx),
        globalUnread: async (src: UserDialogEvent, args: {}, ctx: AppContext) => await Modules.Messaging.fetchUserGlobalCounter(ctx, ctx.auth.uid!),
        haveMention: async (src: UserDialogEvent, args: {}, ctx: AppContext) => Store.UserDialogHaveMention.byId(ctx.auth.uid!, src.cid || (await Store.Message.findById(ctx, src.mid!))!.cid).get(ctx)
    },
    DialogMessageRead: {
        cid: (src: UserDialogEvent) => IDs.Conversation.serialize(src.cid!),
        unread: async (src: UserDialogEvent, args: {}, ctx: AppContext) => Store.UserDialogCounter.byId(ctx.auth.uid!, src.cid || (await Store.Message.findById(ctx, src.mid!))!.cid).get(ctx),
        globalUnread: async (src: UserDialogEvent, args: {}, ctx: AppContext) => await Modules.Messaging.fetchUserGlobalCounter(ctx, ctx.auth.uid!),
        haveMention: async (src: UserDialogEvent, args: {}, ctx: AppContext) => Store.UserDialogHaveMention.byId(ctx.auth.uid!, src.cid || (await Store.Message.findById(ctx, src.mid!))!.cid).get(ctx)
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
        globalUnread: async (src: UserDialogEvent, args: {}, ctx: AppContext) => await Modules.Messaging.fetchUserGlobalCounter(ctx, ctx.auth.uid!)
    },
    DialogBump: {
        cid: (src: UserDialogEvent) => IDs.Conversation.serialize(src.cid!),
        globalUnread: async (src: UserDialogEvent, args: {}, ctx: AppContext) => await Modules.Messaging.fetchUserGlobalCounter(ctx, ctx.auth.uid!),
        unread: async (src: UserDialogEvent, args: {}, ctx: AppContext) => Store.UserDialogCounter.byId(ctx.auth.uid!, src.cid || (await Store.Message.findById(ctx, src.mid!))!.cid).get(ctx),
        topMessage: async (src: UserDialogEvent, args: {}, ctx: AppContext) => {
            return (await Store.Message.chat.query(ctx, src.cid!, { limit: 1, reverse: true })).items[0];
        },
        haveMention: async (src: UserDialogEvent, args: {}, ctx: AppContext) => Store.UserDialogHaveMention.byId(ctx.auth.uid!, src.cid || (await Store.Message.findById(ctx, src.mid!))!.cid).get(ctx)
    },
    DialogMuteChanged: {
        cid: src => IDs.Conversation.serialize(src.cid!),
        mute: src => src.mute,
        globalUnread: async (src: UserDialogEvent, args: {}, ctx: AppContext) => await Modules.Messaging.fetchUserGlobalCounter(ctx, ctx.auth.uid!)
    },
    // depricated
    DialogMentionedChanged: {
        cid: (src: UserDialogEvent) => IDs.Conversation.serialize(src.cid!),
        haveMention: async (src: UserDialogEvent, args: {}, ctx: AppContext) => Store.UserDialogHaveMention.byId(ctx.auth.uid!, src.cid || (await Store.Message.findById(ctx, src.mid!))!.cid).get(ctx)
    },

    Query: {
        dialogsState: withUser(async (ctx, args, uid) => {
            let tail = await Store.UserDialogEvent.user.stream(uid, { batchSize: 1 }).tail(ctx);
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
                let subscribeAfter = args.fromState || null;
                for await (let event of zipedGenerator) {
                    subscribeAfter = event.cursor;
                    yield event;
                }
                if (!subscribeAfter) {
                    subscribeAfter = await Store.UserDialogEvent.user.stream(ctx.auth.uid!, { batchSize: 1 }).tail(ctx);
                }

                // start subscription from last known event
                let generator = Store.UserDialogEvent.user.liveStream(ctx, ctx.auth.uid!, { batchSize: 20, after: subscribeAfter ? subscribeAfter : undefined });
                for await (let event of generator) {
                    yield event;
                }
            }
        },
    }
} as GQLResolver;