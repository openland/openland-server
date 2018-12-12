import { IDs } from 'openland-module-api/IDs';
import { ConversationEvent } from 'openland-module-db/schema';
import { FDB } from 'openland-module-db/FDB';
import { FLiveStreamItem } from 'foundation-orm/FLiveStreamItem';
import { GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
import { AppContext } from 'openland-modules/AppContext';
import { withUser } from 'openland-module-api/Resolvers';

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
    ConversationUpdate: {
        __resolveType(obj: ConversationEvent) {
            if (obj.kind === 'message_received') {
                return 'ConversationMessageReceived';
            } else if (obj.kind === 'message_updated') {
                return 'ConversationMessageUpdated';
            } else if (obj.kind === 'message_deleted') {
                return 'ConversationMessageDeleted';
            } else if (obj.kind === 'dialog_update') {
                return 'ConversationDialogUpdate';
            }
            throw Error('Unknown conversation update type: ' + obj.kind);
        }
    },

    ConversationMessageReceived: {
        message: (src: ConversationEvent, args: {}, ctx: AppContext) => FDB.Message.findById(ctx, src.mid!)
    },
    ConversationMessageUpdated: {
        message: (src: ConversationEvent, args: {}, ctx: AppContext) => FDB.Message.findById(ctx, src.mid!)
    },
    ConversationMessageDeleted: {
        message: (src: ConversationEvent, args: {}, ctx: AppContext) => FDB.Message.findById(ctx, src.mid!)
    },
    ConversationDialogUpdate: {
        dialog: (src: ConversationEvent, args: {}, ctx: AppContext) => FDB.UserDialog.findFromConversation(ctx, src.cid, src.uid!)
    },

    Query: {
        conversationState: withUser(async (ctx, args, uid) => {
            let id = IDs.Conversation.parse(args.id);
            let tail = await FDB.ConversationEvent.createUserStream(ctx, id, 1).tail();
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
            subscribe: (r, args, ctx) => {
                let conversationId = IDs.Conversation.parse(args.conversationId);
                return FDB.ConversationEvent.createUserLiveStream(ctx, conversationId, 20, args.fromState || undefined);
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