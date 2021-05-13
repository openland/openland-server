import { GQL, GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
import { IDs } from '../../openland-module-api/IDs';
import {
    BlackListAddedEvent,
    BlackListRemovedEvent,
} from '../../openland-module-db/store';
import { GQLRoots } from '../../openland-module-api/schema/SchemaRoots';
import BlackListUpdateRoot = GQLRoots.BlackListUpdateRoot;
import { withUser } from '../../openland-module-api/Resolvers';
import { Store } from '../../openland-module-db/FDB';
import { Context } from '@openland/context';
import { AccessDeniedError } from '../../openland-errors/AccessDeniedError';

export const Resolver: GQLResolver = {
    BlackListUpdateContainer: {
        updates: src => src.items,
        state: src => IDs.BlackListUpdatesCursor.serialize(src.cursor || '')
    },
    BlackListUpdate: {
        __resolveType(src: BlackListUpdateRoot) {
            if (src instanceof BlackListAddedEvent) {
                return 'BlackListAdded';
            } else if (src instanceof BlackListRemovedEvent) {
                return 'BlackListRemoved';
            } else {
                throw new Error('unknown black list update: ' + src);
            }
        }
    },
    BlackListAdded: {
        bannedBy: src => src.bannedBy,
        bannedUser: src => src.bannedUid
    },
    BlackListRemoved: {
        bannedBy: src => src.bannedBy,
        bannedUser: src => src.bannedUid
    },
    BlackListUpdatesState: {
        state: src => src.state
    },

    Query: {
        blackListUpdatesState: withUser(async (ctx, args, uid) => {
            let tail = await Store.BlackListEventStore.createStream(uid, { batchSize: 1 }).tail(ctx) || '';
            return {
                state: IDs.BlackListUpdatesCursor.serialize(tail)
            };
        })
    },
    Subscription: {
        blackListUpdates: {
            resolve: (msg: any) => Store.BlackListEventStore.decodeRawLiveStreamItem(msg),
            subscribe: async function (r: any, args: GQL.SubscriptionBlackListUpdatesArgs, ctx: Context) {
                let uid = ctx.auth.uid;
                if (!uid) {
                    throw new AccessDeniedError();
                }
                let userCursor: undefined | string;
                if (args.fromState) {
                    userCursor = IDs.BlackListUpdatesCursor.parse(args.fromState);
                }
                return Store.BlackListEventStore.createRawLiveStream(ctx, uid, { batchSize: 50, after: userCursor });
            }
        }
    }
};