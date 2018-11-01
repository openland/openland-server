import { IDs } from 'openland-server/api/utils/IDs';
import { DB } from 'openland-server/tables';
import { CallContext } from 'openland-server/api/utils/CallContext';
import { AccessDeniedError } from 'openland-server/errors/AccessDeniedError';
import { ConversationEvent } from 'openland-module-db/schema';
import { FDB } from 'openland-module-db/FDB';
import { FLiveStreamItem } from 'foundation-orm/FLiveStreamItem';

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
        message: (src: ConversationEvent) => DB.ConversationMessage.findById(src.mid!, { paranoid: false })
    },
    ConversationMessageUpdated: {
        message: (src: ConversationEvent) => DB.ConversationMessage.findById(src.mid!, { paranoid: false })
    },
    ConversationMessageDeleted: {
        message: (src: ConversationEvent) => DB.ConversationMessage.findById(src.mid!, { paranoid: false })
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
        alphaChatSubscribe2: {
            resolve: async (msg: any) => {
                return msg;
            },
            subscribe: async function (_: any, args: { conversationId: string, fromState?: string }, context: CallContext) {
                let conversationId = IDs.Conversation.parse(args.conversationId);
                if (!context.uid) {
                    throw Error('Not logged in');
                }
                let conversation = (await DB.Conversation.findById(conversationId))!;
                if (conversation.type === 'group' || conversation.type === 'channel') {
                    let member = await DB.ConversationGroupMembers.find({
                        where: {
                            userId: context.uid,
                            status: 'member'
                        }
                    });
                    if (!member) {
                        throw new AccessDeniedError();
                    }
                }
                return FDB.ConversationEvent.createUserLiveStream(conversationId, 20, args.fromState);
            }
        }
    },
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
        seq: (src: ConversationEvent) => src.seq
    },
    ConversationEventMessage: {
        message: (src: ConversationEvent) => DB.ConversationMessage.findById(src.mid!, { paranoid: false })
    },
    ConversationEventEditMessage: {
        message: (src: ConversationEvent) => DB.ConversationMessage.findById(src.mid!, { paranoid: false })
    },
    ConversationEventDelete: {
        messageId: (src: ConversationEvent) => IDs.ConversationMessage.serialize(src.mid!)
    },
};