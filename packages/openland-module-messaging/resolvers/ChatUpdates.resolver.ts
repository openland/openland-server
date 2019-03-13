import { GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
import { ConversationEvent } from '../../openland-module-db/schema';
import { GQLRoots } from '../../openland-module-api/schema/SchemaRoots';
import ChatUpdateContainerRoot = GQLRoots.ChatUpdateContainerRoot;
import { FDB } from '../../openland-module-db/FDB';
import { withUser } from '../../openland-module-api/Resolvers';
import { IDs } from '../../openland-module-api/IDs';

export default {
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
        seq: src => src.items[0].seq,
        state: src => src.cursor,
        update: src => src.items[0],
    },
    ChatUpdateBatch: {
        updates: src => src.items,
        fromSeq: src => src.items[0].seq,
        seq: src => src.items[src.items.length - 1].seq,
        state: src => src.cursor
    },

    ChatUpdate: {
        __resolveType(obj: ConversationEvent) {
            if (obj.kind === 'message_received') {
                return 'ChatMessageReceived';
            } else if (obj.kind === 'message_updated') {
                return 'ChatMessageUpdated';
            } else if (obj.kind === 'message_deleted') {
                return 'ChatMessageDeleted';
            }
            throw Error('Unknown chat update type: ' + obj.kind);
        }
    },

    ChatMessageReceived: {
        message: (src, args, ctx) => FDB.Message.findById(ctx, src.mid!),
        repeatKey: async (src, args, ctx) => {
            let msg = await FDB.Message.findById(ctx, src.mid!);
            if (msg) {
                return msg.repeatKey;
            }
            return null;
        }
    },
    ChatMessageUpdated: {
        message: (src, args, ctx) => FDB.Message.findById(ctx, src.mid!),
    },
    ChatMessageDeleted: {
        message: (src, args, ctx) => FDB.Message.findById(ctx, src.mid!),
    },

    Query: {
        chatState: withUser(async (ctx, args, uid) => {
            let id = IDs.Conversation.parse(args.chatId);
            let tail = await FDB.ConversationEvent.createUserStream(ctx, id, 1).tail();
            return {
                state: tail
            };
        })
    },

    Subscription: {
        chatUpdates: {
            resolve: async msg => {
                return msg;
            },
            subscribe: (r, args, ctx) => {
                let conversationId = IDs.Conversation.parse(args.chatId);
                return FDB.ConversationEvent.createUserLiveStream(ctx, conversationId, 20, args.fromState || undefined);
            }
        },
    },
} as GQLResolver;