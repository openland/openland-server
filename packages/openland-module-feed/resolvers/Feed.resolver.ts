import { FeedEvent, RichMessage } from '../../openland-module-db/store';
import { GQLResolver } from 'openland-module-api/schema/SchemaSpec';
import { withUser } from 'openland-module-api/Resolvers';
import { Modules } from 'openland-modules/Modules';
import { Store } from 'openland-module-db/FDB';
import { IDs } from 'openland-module-api/IDs';
import { GQLRoots } from '../../openland-module-api/schema/SchemaRoots';
import FeedItemContentRoot = GQLRoots.FeedItemContentRoot;
import { AccessDeniedError } from '../../openland-errors/AccessDeniedError';
import { inTx } from '@openland/foundationdb';
import { resolveRichMessageCreation } from '../../openland-module-rich-message/resolvers/resolveRichMessageCreation';

export default {
    FeedItem: {
        id: (src) => IDs.FeedItem.serialize(src.id),
        alphaBy: (src) => src.content.uid,
        content: async (src, args, ctx) => {
            if (src.type === 'post' && src.content.richMessageId) {
                return await Store.RichMessage.findById(ctx, src.content.richMessageId);
            }
            return null;
        },

        text: (src) => src.content.text,
        date: (src) => src.metadata.createdAt,
    },
    FeedPost: {
        message: src => src
    },
    FeedItemContent: {
        __resolveType(src: FeedItemContentRoot) {
            if (src instanceof RichMessage) {
                return 'FeedPost';
            }
            throw new Error('Unknown FeedItemContent: ' + src);
        }
    },
    FeedItemConnection: {
        items: src => src.items,
        cursor: src => src.cursor
    },
    Query: {
        alphaHomeFeed: withUser(async (ctx, args, uid) => {
            let subscriptions = await Modules.Feed.findSubscriptions(ctx, 'user-' + uid);
            let allEvents: FeedEvent[] = [];
            let topicPosts = await Promise.all(subscriptions.map(s => Store.FeedEvent.fromTopic.query(ctx, s, { after: args.after ? IDs.HomeFeedCursor.parse(args.after) : undefined, reverse: true })));
            for (let posts of topicPosts) {
                allEvents.push(...posts.items);
            }
            let items = allEvents.sort((a, b) => b.id - a.id).splice(0, args.first);
            return { items, cursor: IDs.HomeFeedCursor.serialize(items[items.length - 1].id) };
        })
    },
    Mutation: {
        alphaCreateFeedPost: withUser(async (root, args, uid) => {
            return inTx(root, async ctx => {
                return await Modules.Feed.createPost(ctx, uid, 'user-' + uid, await resolveRichMessageCreation(ctx, args));
            });
        }),
        alphaCreateGlobalFeedPost: withUser(async (root, args, uid) => {
            return await inTx(root, async ctx => {
                let isSuperAdmin = (await Modules.Super.superRole(ctx, uid)) === 'super-admin';
                if (!isSuperAdmin) {
                    throw new AccessDeniedError();
                }
                await Modules.Feed.createPost(ctx, uid, 'tag-global', await resolveRichMessageCreation(ctx, args));
                return true;
            });
        }),
    }
} as GQLResolver;