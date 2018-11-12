import { CallContext } from 'openland-module-api/CallContext';
import { IDs } from 'openland-module-api/IDs';
import { FDB } from 'openland-module-db/FDB';
import { FLiveStreamItem } from 'foundation-orm/FLiveStreamItem';
import { UserDialogEvent } from 'openland-module-db/schema';
import { GQLResolver } from '../../openland-module-api/schema/SchemaSpec';

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
            } else if (obj.kind === 'dialog_deleted') {
                return 'DialogDeleted';
            }
            // } else if (obj.eventType === 'chat_update') {
            //     return 'DialogPhotoUpdated';
            // }
            throw Error('Unknown dialog update type: ' + obj.kind);
        }
    },
    DialogMessageReceived: {
        cid: (src: UserDialogEvent) => IDs.Conversation.serialize(src.cid!),
        message: (src: UserDialogEvent) => FDB.Message.findById(src.mid!),
        unread: (src: UserDialogEvent) => src.unread || 0,
        globalUnread: (src: UserDialogEvent) => src.allUnread || 0
    },
    DialogMessageUpdated: {
        message: (src: UserDialogEvent) => FDB.Message.findById(src.mid!),
    },
    DialogMessageDeleted: {
        message: (src: UserDialogEvent) => FDB.Message.findById(src.mid!),
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
        title: (src: UserDialogEvent) => src.title,
    },
    // DialogPhotoUpdated: {
    //     photoRef: async (src: ConversationUserEvents) => (await DB.Conversation.findById(src.event.conversationId as any))!.,
    // },
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
            subscribe: function (_: any, args: { fromState?: string }, context: CallContext) {
                return FDB.UserDialogEvent.createUserLiveStream(context.uid!, 20, args.fromState);
            }
        },
    }
} as GQLResolver;