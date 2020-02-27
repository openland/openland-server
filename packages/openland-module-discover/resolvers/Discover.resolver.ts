import { GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
import { withActivatedUser } from '../../openland-module-api/Resolvers';
import { Modules } from '../../openland-modules/Modules';
import { IDs } from '../../openland-module-api/IDs';

export const Resolver: GQLResolver = {
    Query: {
        discoverPopularNow: withActivatedUser(async (ctx, args) => {
            let after = 0;
            if (args.after) {
                after = IDs.DiscoverPopularNowCursor.parse(args.after);
            }
            let popular = await Modules.Stats.getTrendingRoomsByMessages(
                ctx,
                Date.now() - 7 * 24 * 60 * 60 * 1000,
                Date.now(),
                args.first,
                after
            );

            return {
                items: popular.map(a => a.room.id),
                cursor: popular.length === args.first ? IDs.DiscoverPopularNowCursor.serialize(popular[popular.length - 1].cursor) : null
            };
        })
    }
};
