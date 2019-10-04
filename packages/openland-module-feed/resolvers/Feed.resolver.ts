import {
    Conversation,
    FeedChannel,
    FeedEvent,
    FeedTopic,
    Organization,
    RichMessage,
    User
} from '../../openland-module-db/store';
import { GQLResolver } from 'openland-module-api/schema/SchemaSpec';
import { withUser } from 'openland-module-api/Resolvers';
import { Modules } from 'openland-modules/Modules';
import { Store } from 'openland-module-db/FDB';
import { IDs } from 'openland-module-api/IDs';
import { GQLRoots } from '../../openland-module-api/schema/SchemaRoots';
import { resolveRichMessageCreation } from '../../openland-module-rich-message/resolvers/resolveRichMessageCreation';
import FeedItemRoot = GQLRoots.FeedItemRoot;
import { AppContext } from '../../openland-modules/AppContext';
import { fetchMessageFallback, hasMention } from '../../openland-module-messaging/resolvers/ModernMessage.resolver';
import SlideRoot = GQLRoots.SlideRoot;
import FeedPostAuthorRoot = GQLRoots.FeedPostAuthorRoot;
import SlideAttachmentRoot = GQLRoots.SlideAttachmentRoot;
import { buildBaseImageUrl } from '../../openland-module-media/ImageRef';
import FeedSubscriptionRoot = GQLRoots.FeedSubscriptionRoot;
import FeedPostSourceRoot = GQLRoots.FeedPostSourceRoot;

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
    FeedPostAuthor: {
        __resolveType(src: FeedPostAuthorRoot) {
            if (src instanceof User) {
                return 'User';
            }
            throw new Error('Unknown post author type: ' + src);
        }
    },
    FeedPost: {
        id: (src) => IDs.FeedItem.serialize(src.id),
        date: src => src.metadata.createdAt,
        author: withRichMessage(async (ctx, message) => await Store.User.findById(ctx, message.uid)),
        source: withRichMessage(async (ctx, message, src) => {
            let topic = (await Store.FeedTopic.findById(ctx, src.tid))!;
            if (!topic.key.startsWith('channel-')) {
                return null;
            }
            let channelId = parseInt(topic.key.replace('channel-', ''), 10);
            return await Store.FeedChannel.findById(ctx, channelId);
        }),
        edited: withRichMessage((ctx, message, src) => src.edited || false),
        canEdit: withRichMessage(async (ctx, message, src) => {
            if (message.uid === ctx.auth.uid) {
                return true;
            } else if (message.oid) {
                return await Modules.Orgs.isUserAdmin(ctx, ctx.auth.uid!, message.oid);
            } else {
                return false;
            }
        }),
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
            if (!src.cover) {
                return null;
            } else if (src.coverAlign === 'top') {
                return 'Top';
            } else if (src.coverAlign === 'bottom') {
                return 'Bottom';
            } else if (src.coverAlign === 'cover') {
                return 'Cover';
            }
            return null;
        },
        attachments: async (src, args, ctx) => {
            if (src.attachments) {
                let out: (User | Conversation | Organization)[] = [];
                for (let attach of src.attachments) {
                    if (attach.type === 'user') {
                        out.push((await Store.User.findById(ctx, attach.userId))!);
                    } else if (attach.type === 'room') {
                        out.push((await Store.Conversation.findById(ctx, attach.roomId))!);
                    } else if (attach.type === 'organization') {
                        out.push((await Store.Organization.findById(ctx, attach.orgId))!);
                    }
                }
                return out;
            }
            return [];
        }
    },
    SlideAttachment: {
        __resolveType(src: SlideAttachmentRoot) {
            if (src instanceof User) {
                return 'User';
            } else if (src instanceof Conversation) {
                return 'SharedRoom';
            } else if (src instanceof Organization) {
                return 'Organization';
            }
            throw new Error('Unknown slide attachment: ' + src);
        }
    },

    FeedChannelConnection: {
        items: src => src.items,
        cursor: src => src.cursor
    },
    FeedChannel: {
        id: src => IDs.FeedChannel.serialize(src.id),
        title: src => src.title,
        about: src => src.about,
        photo: src => src.image ? buildBaseImageUrl(src.image) : null,
    },
    FeedSubscription: {
        __resolveType(src: FeedSubscriptionRoot) {
            if (src instanceof FeedChannel) {
                return 'FeedChannel';
            } else {
                throw new Error('Unknown feed subscription root: ' + src);
            }
        }
    },
    FeedPostSource: {
        __resolveType(src: FeedPostSourceRoot) {
            if (src instanceof FeedChannel) {
                return 'FeedChannel';
            } else {
                throw new Error('Unknown feed subscription root: ' + src);
            }
        }
    },

    Query: {
        alphaHomeFeed: withUser(async (ctx, args, uid) => {
            let subscriptions = await Modules.Feed.findSubscriptions(ctx, 'user-' + uid);
            let topics: FeedTopic[] = await Promise.all(subscriptions.map(tid => Store.FeedTopic.findById(ctx, tid))) as FeedTopic[];
            topics = topics.filter(t => t.key.startsWith('channel-'));

            let allEvents: FeedEvent[] = [];
            let topicPosts = await Promise.all(topics.map(t => Store.FeedEvent.fromTopic.query(ctx, t.id, { after: args.after ? IDs.HomeFeedCursor.parse(args.after) : undefined, reverse: true, limit: args.first })));
            for (let posts of topicPosts) {
                allEvents.push(...posts.items);
            }
            let items = allEvents.sort((a, b) => b.id - a.id).splice(0, args.first);
            return { items, cursor: items.length > 0 ? IDs.HomeFeedCursor.serialize(items[items.length - 1].id) : undefined };
        }),
        alphaFeedItem: withUser(async (ctx, args, uid) => {
            let id = IDs.FeedItem.parse(args.id);
            let event = await Store.FeedEvent.findById(ctx, id);

            if (event && !event.deleted) {
                return event;
            }
            return null;
        }),

        alphaFeedMyChannels: withUser(async (ctx, args, uid) => {
            let afterId = args.after ? IDs.FeedChannel.parse(args.after) : null;
            if (!args.first || args.first <= 0) {
                return { items: [] };
            }
            let afterExists = afterId && await Store.FeedChannel.findById(ctx, afterId);
            let {items, haveMore} = await Store.FeedChannel.owner.query(ctx, uid, { limit: args.first, after: afterExists ? afterId : undefined });
            return {
                items,
                cursor: haveMore ? IDs.FeedChannel.serialize(items[items.length - 1].id) : undefined
            };
        }),
        alphaFeedMySubscriptions: withUser(async (ctx, args, uid) => {
            let subscriptions = await Modules.Feed.findSubscriptions(ctx, 'user-' + uid);
            let topics: FeedTopic[] = (await Promise.all(subscriptions.map(tid => Store.FeedTopic.findById(ctx, tid)))).filter(t => !!t) as FeedTopic[];

            let res: (User | FeedChannel)[] = [];

            for (let topic of topics.filter(t => t.key.startsWith('channel-'))) {
                res.push((await Store.FeedChannel.findById(ctx, parseInt(topic.key.replace('channel-', ''), 10)))!);
            }

            return res;
        }),

        alphaFeedChannel: withUser(async (ctx, args, uid) => {
            return await Store.FeedChannel.findById(ctx, IDs.FeedChannel.parse(args.id));
        }),
        alphaFeedChannelContent: withUser(async (ctx, args, uid) => {
            let topic = await Modules.Feed.resolveTopic(ctx, 'channel-' + IDs.FeedChannel.parse(args.id));
            let data = await Store.FeedEvent.fromTopic.query(ctx, topic.id, {
                limit: args.first,
                reverse: true,
                after: args.after ? IDs.HomeFeedCursor.parse(args.after) : undefined
            });

            return { items: data.items, cursor: data.haveMore ? IDs.HomeFeedCursor.serialize(data.items[data.items.length - 1].id) : undefined };
        }),
    },
    Mutation: {
        alphaCreateFeedPost: withUser(async (ctx, args, uid) => {
            let channelId = IDs.FeedChannel.parse(args.channel);
            return await Modules.Feed.createPost(ctx, uid, 'channel-' + channelId, { ...await resolveRichMessageCreation(ctx, args), repeatKey: args.repeatKey });
        }),
        alphaEditFeedPost: withUser(async (ctx, args, uid) => {
            return await Modules.Feed.editPost(ctx, uid, IDs.FeedItem.parse(args.feedItemId), await resolveRichMessageCreation(ctx, args));
        }),
        alphaDeleteFeedPost: withUser(async (ctx, args, uid) => {
            return await Modules.Feed.deletePost(ctx, uid, IDs.FeedItem.parse(args.feedItemId));
        }),
        feedReactionAdd: withUser(async (ctx, args, uid) => {
            return await Modules.Feed.setReaction(ctx, uid, IDs.FeedItem.parse(args.feedItemId), args.reaction);
        }),
        feedReactionRemove: withUser(async (ctx, args, uid) => {
            return await Modules.Feed.setReaction(ctx, uid, IDs.FeedItem.parse(args.feedItemId), args.reaction, true);
        }),

        alphaFeedCreateChannel: withUser(async (ctx, args, uid) => {
            return await Modules.Feed.createFeedChannel(ctx, uid, {
                title: args.title,
                about: args.about || undefined,
                image: args.photoRef || undefined,
                global: args.global || undefined
            });
        }),
        alphaFeedUpdateChannel: withUser(async (ctx, args, uid) => {
            return await Modules.Feed.updateFeedChannel(ctx, IDs.FeedChannel.parse(args.id), uid, {
                title: args.title,
                about: args.about || undefined,
                image: args.photoRef || undefined,
                global: args.global || undefined
            });
        }),
    }
} as GQLResolver;