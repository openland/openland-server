import { GQL, GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { withActivatedUser } from '../openland-module-api/Resolvers';
import { Store } from '../openland-module-db/FDB';
import { VoiceChatUpdatedEvent } from '../openland-module-db/store';
import { GQLRoots } from '../openland-module-api/schema/SchemaRoots';
import ActiveVoiceChatsEventRoot = GQLRoots.ActiveVoiceChatsEventRoot;
import { Context } from '@openland/context';
import { AccessDeniedError } from '../openland-errors/AccessDeniedError';
import { Modules } from '../openland-modules/Modules';

export const Resolver: GQLResolver = {
    ActiveVoiceChatsEvent: {
        __resolveType(src: ActiveVoiceChatsEventRoot) {
            if (src instanceof VoiceChatUpdatedEvent) {
                return 'VoiceChatUpdatedEvent';
            } else {
                throw new Error('unknown voice chat event: ' + src);
            }
        }
    },

    Query: {
        activeVoiceChats: withActivatedUser(async (ctx, args, uid) => {
            let res = await Store.ConversationVoice.active.query(ctx, { limit: args.first, afterCursor: args.after });
            return {
                items: res.items,
                cursor: res.cursor || null
            };
        }),
    },

    Subscription: {
        activeVoiceChatsEvents: {
            resolve: (msg: any) => msg,
            subscribe: async function * (r: any, args: GQL.SubscriptionActiveVoiceChatsEventsArgs, ctx: Context) {
                let uid = ctx.auth.uid;
                if (!uid) {
                    throw new AccessDeniedError();
                }

                let iterator = Modules.VoiceChats.events.createActiveChatsLiveStream(ctx);

                for await (let ev of iterator) {
                     yield [ev];
                }
            }
        }
    }
};