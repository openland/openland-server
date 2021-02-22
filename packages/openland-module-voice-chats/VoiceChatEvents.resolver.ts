import { GQL, GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { Store } from '../openland-module-db/FDB';
import {
    VoiceChatParticipantUpdatedEvent,
    VoiceChatUpdatedEvent
} from '../openland-module-db/store';
import { GQLRoots } from '../openland-module-api/schema/SchemaRoots';
import VoiceChatEventRoot = GQLRoots.VoiceChatEventRoot;
import { IDs } from '../openland-module-api/IDs';
import { withUser } from '../openland-module-api/Resolvers';
import { Context } from '@openland/context';
import { AccessDeniedError } from '../openland-errors/AccessDeniedError';

export const Resolver: GQLResolver = {
    VoiceChatParticipantUpdatedEvent: {
        chat: async (src, {}, ctx) => (await Store.ConversationVoice.findById(ctx, src.cid))!,
        participant: async (src, {}, ctx) => (await Store.VoiceChatParticipant.findById(ctx, src.cid, src.uid))!,
    },
    VoiceChatUpdatedEvent: {
        chat: async (src, {}, ctx) => (await Store.ConversationVoice.findById(ctx, src.cid))!,
    },
    VoiceChatEvent: {
        __resolveType(src: VoiceChatEventRoot) {
            if (src instanceof VoiceChatParticipantUpdatedEvent) {
                return 'VoiceChatParticipantUpdatedEvent';
            } else if (src instanceof VoiceChatUpdatedEvent) {
                return 'VoiceChatUpdatedEvent';
            } else {
                throw new Error('unknown voice chat event: ' + src);
            }
        }
    },

    VoiceChatEventsState: {
        state: src => src.state
    },
    VoiceChatEventsContainer: {
        events: src => src.items,
        state: src => IDs.VoiceChatEventsCursor.serialize(src.cursor || '')
    },

    Query: {
        voiceChatEventsState: withUser(async (ctx, args, uid) => {
            let tail = await Store.VoiceChatEventsStore.createStream(IDs.Conversation.parse(args.id), { batchSize: 1 }).tail(ctx) || '';
            return { state: IDs.VoiceChatEventsCursor.serialize(tail) };
        })
    },

    Subscription: {
        voiceChatEvents: {
            resolve: (msg: any) => msg,
            subscribe: async function (r: any, args: GQL.SubscriptionVoiceChatEventsArgs, ctx: Context) {
                let uid = ctx.auth.uid;
                if (!uid) {
                    throw new AccessDeniedError();
                }
                let cursor: undefined|string;
                if (args.fromState) {
                    cursor = IDs.VoiceChatEventsCursor.parse(args.fromState);
                }
                return Store.VoiceChatEventsStore.createLiveStream(ctx, IDs.Conversation.parse(args.id), { batchSize: 50, after: cursor });
            }
        }
    }
};