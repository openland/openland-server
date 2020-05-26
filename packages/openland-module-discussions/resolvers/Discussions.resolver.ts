import { IDs } from '../../openland-module-api/IDs';
import { GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
import { Store } from '../../openland-module-db/FDB';
import { Discussion } from '../../openland-module-db/store';
import { withUser } from '../../openland-module-api/Resolvers';
import { Modules } from '../../openland-modules/Modules';

export const Resolver: GQLResolver = {
    Discussion: {
        id: src => IDs.Discussion.serialize(src.id),
        author: src => src.uid,
        title: src => src.title,
        hub: async (src, args, ctx) => (await Store.DiscussionHub.findById(ctx, src.hubId))!,
        createdAt: src => src.metadata.createdAt,
        updatedAt: src => src.metadata.updatedAt,
        deletedAt: src => src.archivedAt
    },

    DiscussionConnection: {
        items: src => src.items,
        cursor: src => src.cursor
    },

    Query: {
        discussions: async (_, args, ctx) => {
            let hubIds = args.hubs.map(h => IDs.Hub.parse(h));
            let discussions = await Promise.all(hubIds.map(hub => Store.Discussion.published.query(ctx, hub, {
                limit: args.limit + 1,
                reverse: true,
                after: args.after ? IDs.DiscussionCursor.parse(args.after) : null
            })));
            let allDiscussions: Discussion[] = [];
            for (let res of discussions) {
                allDiscussions.push(...res.items);
            }
            let items = allDiscussions.sort((a, b) => b.publishedAt! - a.publishedAt!).splice(0, args.limit);
            let haveMore = allDiscussions.length > args.limit;

            return {
                items,
                cursor: items.length > 0 && haveMore ? IDs.DiscussionCursor.serialize(items[items.length - 1].publishedAt!) : null
            };
        }
    },

    Mutation: {
        discussionCreate: withUser(async (ctx, args, uid) => {
            return await Modules.Discussions.discussions.createDiscussion(ctx, uid, IDs.Hub.parse(args.hub), {
                title: args.input.title!,
                isDraft: args.isDraft
            });
        })
    }
};