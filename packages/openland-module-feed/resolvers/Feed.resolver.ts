import { FeedEvent, RichMessage } from '../../openland-module-db/store';
import { GQLResolver } from 'openland-module-api/schema/SchemaSpec';
import { withUser } from 'openland-module-api/Resolvers';
import { Modules } from 'openland-modules/Modules';
import { Store } from 'openland-module-db/FDB';
import { IDs } from 'openland-module-api/IDs';
import { GQLRoots } from '../../openland-module-api/schema/SchemaRoots';
import { AccessDeniedError } from '../../openland-errors/AccessDeniedError';
import { inTx } from '@openland/foundationdb';
import { resolveRichMessageCreation } from '../../openland-module-rich-message/resolvers/resolveRichMessageCreation';
import FeedItemRoot = GQLRoots.FeedItemRoot;
import { AppContext } from '../../openland-modules/AppContext';
import { fetchMessageFallback, hasMention } from '../../openland-module-messaging/resolvers/ModernMessage.resolver';
import SlideRoot = GQLRoots.SlideRoot;

export function withRichMessage<T>(handler: (ctx: AppContext, message: RichMessage, src: FeedEvent) => Promise<T>|T) {
    return async (src: FeedEvent, _params: {}, ctx: AppContext) => {
        let message = await Store.RichMessage.findById(ctx, src.content.richMessageId);
        return handler(ctx, message!, src);
    };
}

export default {
    FeedItem: {
        __resolveType(src: FeedItemRoot) {
            if (src.type === 'post') {
                return 'FeedPost';
            }
            throw new Error('Unknown feed item type: ' + src.type);
        }
    },
    FeedPost: {
        id: (src) => IDs.FeedItem.serialize(src.id),
        date: src => src.metadata.createdAt,
        sender: withRichMessage((ctx, message) => message.uid),
        edited: withRichMessage((ctx, message, src) => src.edited || false),
        reactions: withRichMessage((ctx, message) => message.reactions || []),
        isMentioned: withRichMessage((ctx, message) => hasMention(message, ctx.auth.uid!)),
        message: withRichMessage((ctx, message) => message.text),
        spans: withRichMessage((ctx, message) => message.spans || []),
        attachments: withRichMessage((ctx, message) => message.attachments ? message.attachments.map(a => ({ message: message, attachment: a })) : []),
        commentsCount: withRichMessage(async (ctx, message, src) => {
            let state = await Store.CommentState.findById(ctx, 'feed_item', src.id);
            return (state && state.commentsCount) || 0;
        }),
        slides: withRichMessage((ctx, message) => message.slides || []),
        fallback: withRichMessage((ctx, message) => fetchMessageFallback(message)),
    },
    FeedItemConnection: {
        items: src => src.items,
        cursor: src => src.cursor
    },
    Slide: {
        __resolveType(src: SlideRoot) {
            if (src.type === 'text') {
                return 'TextSlide';
            }
            throw new Error('Unknown slide type: ' + src.type);
        }
    },
    TextSlide: {
        id: src => IDs.Slide.serialize(src.id),
        text: src => src.text,
        spans: src => src.spans || [],
        cover: src => src.cover ? { uuid: src.cover.image.uuid, metadata: src.cover.info, crop: src.cover.image.crop } : undefined,
        coverAlign: src => {
            if (src.coverAlign === 'top') {
                return 'Top';
            } else if (src.coverAlign === 'bottom') {
                return 'Bottom';
            } else if (src.coverAlign === 'cover') {
                return 'Cover';
            }
            return 'Top';
        }

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
            return { items, cursor: items.length > 0 ? IDs.HomeFeedCursor.serialize(items[items.length - 1].id) : undefined };
        })
    },
    Mutation: {
        alphaCreateFeedPost: withUser(async (ctx, args, uid) => {
            return await Modules.Feed.createPost(ctx, uid, 'user-' + uid, await resolveRichMessageCreation(ctx, args));
        }),
        alphaEditFeedPost: withUser(async (ctx, args, uid) => {
            return await Modules.Feed.editPost(ctx, uid, IDs.FeedItem.parse(args.feedItemId), await resolveRichMessageCreation(ctx, args));
        }),
        alphaDeleteFeedPost: withUser(async (ctx, args, uid) => {
            return await Modules.Feed.deletePost(ctx, uid, IDs.FeedItem.parse(args.feedItemId));
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
        feedReactionAdd: withUser(async (ctx, args, uid) => {
            return await Modules.Feed.setReaction(ctx, uid, IDs.FeedItem.parse(args.feedItemId), args.reaction);
        }),
        feedReactionRemove: withUser(async (ctx, args, uid) => {
            return await Modules.Feed.setReaction(ctx, uid, IDs.FeedItem.parse(args.feedItemId), args.reaction, true);
        }),
        feedSubscribeUser: withUser(async (ctx, args, uid) => {
            await Modules.Feed.subscribe(ctx, 'user-' + uid, 'user-' + IDs.User.parse(args.uid));
            return true;
        }),
        feedUnsubscribeUser: withUser(async (ctx, args, uid) => {
            await Modules.Feed.unsubscribe(ctx, 'user-' + uid, 'user-' + IDs.User.parse(args.uid));
            return true;
        })
    }
} as GQLResolver;