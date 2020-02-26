import { GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
import { withActivatedUser } from '../../openland-module-api/Resolvers';
import { Modules } from '../../openland-modules/Modules';

export const Resolver: GQLResolver = {
    Query: {
        discoverPopularNow: withActivatedUser(async (ctx, args) => {
            let popular = await Modules.Stats.getTrendingRoomsByMessages(ctx, Date.now() - 7 * 24 * 60 * 60 * 1000, Date.now(), args.after as unknown as number, args.first);
            return {
                items: popular.map(a => a.room.id),
                cursor: popular.length === args.first ? popular[popular.length - 1].cursor.toString() : null
            };
        })
    }
};
