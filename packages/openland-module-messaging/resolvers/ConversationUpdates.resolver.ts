import { IDs } from 'openland-module-api/IDs';
import { CallContext } from 'openland-module-api/CallContext';
import { ConversationEvent } from 'openland-module-db/schema';
import { FDB } from 'openland-module-db/FDB';
import { FLiveStreamItem } from 'foundation-orm/FLiveStreamItem';
import { GQLResolver } from '../../openland-module-api/schema/SchemaSpec';

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
            }
            throw Error('Unknown conversation update type: ' + obj.kind);
        }
    },

    ConversationMessageReceived: {
        message: (src: ConversationEvent) => FDB.Message.findById(src.mid!)
    },
    ConversationMessageUpdated: {
        message: (src: ConversationEvent) => FDB.Message.findById(src.mid!)
    },
    ConversationMessageDeleted: {
        message: (src: ConversationEvent) => FDB.Message.findById(src.mid!)
    },

    Subscription: {
        conversationUpdates: {
            resolve: async (msg: any) => {
                return msg;
            },
            subscribe: function (_: any, args: { conversationId: string, fromState?: string }, context: CallContext) {
                let conversationId = IDs.Conversation.parse(args.conversationId);
                return FDB.ConversationEvent.createUserLiveStream(conversationId, 20, args.fromState);
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
        message: (src: ConversationEvent) => FDB.Message.findById(src.mid!),
        seq: (src: ConversationEvent) => src.seq
    },
    ConversationEventEditMessage: {
        message: (src: ConversationEvent) => FDB.Message.findById(src.mid!),
        seq: (src: ConversationEvent) => src.seq
    },
    ConversationEventDelete: {
        messageId: (src: ConversationEvent) => IDs.ConversationMessage.serialize(src.mid!),
        seq: (src: ConversationEvent) => src.seq
    },
} as GQLResolver;