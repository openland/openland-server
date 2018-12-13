import { IDs } from 'openland-module-api/IDs';
import { FDB } from 'openland-module-db/FDB';
import { FLiveStreamItem } from 'foundation-orm/FLiveStreamItem';
import { UserDialogEvent } from 'openland-module-db/schema';
import { GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
import { AppContext } from 'openland-modules/AppContext';
import { Modules } from 'openland-modules/Modules';
import { buildBaseImageUrl } from 'openland-module-media/ImageRef';

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
        fromSeq: (src: FLiveStreamItem<UserDialogEvent>) => src.items[0].seq,
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
            }
            throw Error('Unknown dialog update type: ' + obj.kind);
        }
    },
    DialogMessageReceived: {
        cid: (src: UserDialogEvent) => IDs.Conversation.serialize(src.cid!),
        message: (src: UserDialogEvent, args: {}, ctx: AppContext) => FDB.Message.findById(ctx, src.mid!),
        unread: (src: UserDialogEvent) => src.unread || 0,
        globalUnread: (src: UserDialogEvent) => src.allUnread || 0
    },
    DialogMessageUpdated: {
        cid: async (src: UserDialogEvent, args: {}, ctx: AppContext) => IDs.Conversation.serialize(src.cid || (await FDB.Message.findById(ctx, src.mid!))!.cid),
        message: (src: UserDialogEvent, args: {}, ctx: AppContext) => FDB.Message.findById(ctx, src.mid!),
    },
    DialogMessageDeleted: {
        cid: async (src: UserDialogEvent, args: {}, ctx: AppContext) => IDs.Conversation.serialize(src.cid || (await FDB.Message.findById(ctx, src.mid!))!.cid),
        message: (src: UserDialogEvent, args: {}, ctx: AppContext) => FDB.Message.findById(ctx, src.mid!),
        unread: (src: UserDialogEvent) => src.unread || 0,
        globalUnread: (src: UserDialogEvent) => src.allUnread || 0
    },
    DialogMessageRead: {
        cid: (src: UserDialogEvent) => IDs.Conversation.serialize(src.cid!),
        unread: (src: UserDialogEvent) => src.unread || 0,
        globalUnread: (src: UserDialogEvent) => src.allUnread || 0
    },
    DialogTitleUpdated: {
        cid: (src: UserDialogEvent) => IDs.Conversation.serialize(src.cid!),
        title: async (src: UserDialogEvent, args: {}, ctx: AppContext) => {
            let profile = await FDB.RoomProfile.findById(ctx, src.cid!);
            return profile ? profile.title : '';
        },
    },
    DialogPhotoUpdated: {
        cid: (src: UserDialogEvent) => IDs.Conversation.serialize(src.cid!),
        photo: async (src: UserDialogEvent, args: {}, ctx: AppContext) => {
            let profile = await FDB.RoomProfile.findById(ctx, src.cid!);
            return profile && profile.image && buildBaseImageUrl(profile.image);
        },
    },
    DialogDeleted: {
        cid: (src: UserDialogEvent) => IDs.Conversation.serialize(src.cid!),
        globalUnread: (src: UserDialogEvent) => src.allUnread || 0
    },

    /*
     * Subscription
     */
    Subscription: {
        dialogsUpdates: {
            resolve: async (msg: any) => {
                return msg;
            },
            subscribe: (r, args, ctx) => {
                return FDB.UserDialogEvent.createUserLiveStream(ctx, ctx.auth.uid!, 20, args.fromState || undefined);
            }
        },
    }
} as GQLResolver;