import { withAny } from '../openland-module-api/Resolvers';
import { Modules } from 'openland-modules/Modules';
import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';

export default {
    Query: {
        trendingRoomsByMessages: withAny( async (ctx, args) => {
            return await Modules.Stats.getTrendingRoomsByMessages(ctx, args.from.getTime(), args.to.getTime(), args.size || undefined);
        })
    },
} as GQLResolver;