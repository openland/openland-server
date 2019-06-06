import { withUser } from 'openland-module-api/Resolvers';
import { Modules } from 'openland-modules/Modules';
import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';

export default {
    Tag: {
        id: src => src.id,
        title: src => src.title,
    },

    TagGroup: {
        id: src => src.id,
        title: src => src.title,
        subtitle: src => src.subtitle,
        tags: src => src.tags,
    },

    Query: {
        betaNextDiscoverPage: withUser((ctx, args, uid) => {
            return Modules.Discover.nextPage(args.selectedTagsIds, args.excudedGroupsIds);
        }),
        betaSuggestedRooms: withUser((ctx, args, uid) => {
            return Modules.Discover.suggestedChats(args.selectedTagsIds);
        })
    }
} as GQLResolver;