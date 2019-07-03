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
        // deprecated
        betaNextDiscoverPage: withUser((ctx, args, uid) => {
            return Modules.Discover.nextPage(ctx, uid, args.selectedTagsIds, args.excudedGroupsIds);
        }),
        gammaNextDiscoverPage: withUser((ctx, args, uid) => {
            return Modules.Discover.gammaNextPage(ctx, uid, args.selectedTagsIds, args.excudedGroupsIds);
        }),
        betaSuggestedRooms: withUser((ctx, args, uid) => {
            return Modules.Discover.suggestedChats(ctx, uid);
        }),
        betaIsDiscoverDone: withUser((ctx, args, uid) => {
            return Modules.Discover.isDiscoverDone(ctx, uid);
        })
    },

    Mutation: {
        betaNextDiscoverPageOrChats: withUser((ctx, args, uid) => {
            return Modules.Discover.nextPage(ctx, uid, args.selectedTagsIds, args.excudedGroupsIds);
        }),
        betaNextDiscoverReset: withUser((ctx, args, uid) => {
            return Modules.Discover.reset(ctx, uid);
        }),
        betaDiscoverSkip: withUser((ctx, args, uid) => {
            return Modules.Discover.skip(ctx, uid, args.selectedTagsIds);
        }),
        betaSaveSelectedTags: withUser((ctx, args, uid) => {
            return Modules.Discover.saveSelectedTags(ctx, uid, args.selectedTagsIds);
        }),
        betaSubmitNextDiscover: withUser((ctx, args, uid) => {
            return Modules.Discover.submitNext(ctx, uid, args.selectedTagsIds, args.excudedGroupsIds);
        })
    }
} as GQLResolver;