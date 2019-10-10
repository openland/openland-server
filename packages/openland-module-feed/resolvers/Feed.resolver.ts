import {
    Conversation,
    FeedChannel,
    FeedEvent, FeedSubscriber,
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
import { NotFoundError } from '../../openland-errors/NotFoundError';
import { AccessDeniedError } from '../../openland-errors/AccessDeniedError';
import { buildElasticQuery, QueryParser } from '../../openland-utils/QueryParser';
import { inTx } from '@openland/foundationdb';

export function withRichMessage<T>(handler: (ctx: AppContext, message: RichMessage, src: FeedEvent) => Promise<T> | T) {
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
        attachments: withRichMessage((ctx, message) => message.attachments ? message.attachments.map(a => ({
            message: message,
            attachment: a
        })) : []),
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
        cover: src => src.cover ? {
            uuid: src.cover.image.uuid,
            metadata: src.cover.info,
            crop: src.cover.image.crop
        } : undefined,
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
        socialImage: src => src.image ? buildBaseImageUrl(src.socialImage) : null,
        subscribed: async (src, args, ctx) => {
            let uid = ctx.auth.uid!;
            let subscriber = await Modules.Feed.resolveSubscriber(ctx, 'user-' + uid);
            let topic = await Modules.Feed.resolveTopic(ctx, 'channel-' + src.id);
            let subscription = await Store.FeedSubscription.findById(ctx, subscriber.id, topic.id);
            if (subscription && subscription.enabled) {
                return true;
            }
            return false;
        },
        myRole: async (src, args, ctx) => {
            let role = await Modules.Feed.roleInChannel(ctx, src.id, ctx.auth.uid!);
            if (role === 'creator') {
                return 'Creator';
            } else if (role === 'editor') {
                return 'Editor';
            } else if (role === 'subscriber') {
                return 'Subscriber';
            }
            return 'None';
        },
        subscribersCount: async (src, args, ctx) => await Store.FeedChannelMembersCount.get(ctx, src.id),
        isGlobal: async (src, args, ctx) => src.isGlobal || false
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
    FeedChannelAdmin: {
        user: src => src.uid,
        promoter: src => src.promoter || null,
        role: src => {
            if (src.role === 'editor') {
                return 'Editor';
            } else if (src.role === 'creator') {
                return 'Creator';
            }
            throw new NotFoundError();
        }
    },
    FeedChannelSubscriber: {
        user: src => src.user,
        role: async (src, args, ctx) => {
            let role = await Modules.Feed.roleInChannel(ctx, src.channelId, src.user.id);
            if (role === 'creator') {
                return 'Creator';
            } else if (role === 'editor') {
                return 'Editor';
            } else if (role === 'subscriber') {
                return 'Subscriber';
            }
            return 'None';
        }
    },

    Query: {
        alphaHomeFeed: withUser(async (ctx, args, uid) => {
            let subscriptions = await Modules.Feed.findSubscriptions(ctx, 'user-' + uid);
            let topics: FeedTopic[] = await Promise.all(subscriptions.map(tid => Store.FeedTopic.findById(ctx, tid))) as FeedTopic[];
            topics = topics.filter(t => t.key.startsWith('channel-'));

            let allEvents: FeedEvent[] = [];
            let topicPosts = await Promise.all(topics.map(t => Store.FeedEvent.fromTopic.query(ctx, t.id, {
                after: args.after ? IDs.HomeFeedCursor.parse(args.after) : undefined,
                reverse: true,
                limit: args.first
            })));
            for (let posts of topicPosts) {
                allEvents.push(...posts.items);
            }
            let items = allEvents.sort((a, b) => b.id - a.id).splice(0, args.first);
            return {
                items,
                cursor: items.length > 0 ? IDs.HomeFeedCursor.serialize(items[items.length - 1].id) : undefined
            };
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
                return {items: []};
            }
            let afterExists = afterId && await Store.FeedChannel.findById(ctx, afterId);
            let {items, haveMore} = await Store.FeedChannel.owner.query(ctx, uid, {
                limit: args.first,
                after: afterExists ? afterId : undefined
            });
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
        alphaWritableChannels: withUser(async (ctx, args, uid) => {
            let afterId = args.after ? IDs.FeedChannel.parse(args.after) : null;
            if (!args.first || args.first <= 0) {
                return {items: []};
            }
            let afterExists = afterId && await Store.FeedChannelAdmin.findById(ctx, afterId, uid);
            let {items, haveMore} = await Store.FeedChannelAdmin.fromUser.query(ctx, uid, {
                limit: args.first,
                after: afterExists ? afterId : undefined
            });
            return {
                items: await Promise.all(items.map(a => Store.FeedChannel.findById(ctx, a.channelId))),
                cursor: haveMore ? IDs.FeedChannel.serialize(items[items.length - 1].channelId) : undefined
            };
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

            return {
                items: data.items,
                cursor: data.haveMore ? IDs.HomeFeedCursor.serialize(data.items[data.items.length - 1].id) : undefined
            };
        }),
        alphaFeedChannelAdmins: withUser(async (ctx, args, uid) => {
            let channelId = IDs.FeedChannel.parse(args.id);
            let role = await Modules.Feed.roleInChannel(ctx, channelId, uid);
            if (role !== 'creator' && role !== 'editor') {
                throw new AccessDeniedError();
            }
            let data = await Store.FeedChannelAdmin.channel.query(ctx, channelId, {
                limit: args.first,
                after: args.after ? IDs.User.parse(args.after) : undefined
            });

            return {
                items: data.items,
                cursor: data.haveMore ? IDs.User.serialize(data.items[data.items.length - 1].uid) : undefined
            };
        }),

        alphaFeedChannelSearch: withUser(async (ctx, args, uid) => {
            let clauses: any[] = [];
            let sort: any[] | undefined = undefined;

            let parser = new QueryParser();
            parser.registerPrefix('title', 'title');
            parser.registerBoolean('isService', 'isService');
            parser.registerText('createdAt', 'createdAt');
            parser.registerText('updatedAt', 'updatedAt');
            parser.registerInt('subscribersCount', 'subscribersCount');

            if (args.query) {
                let parsed = parser.parseQuery(args.query);
                let elasticQuery = buildElasticQuery(parsed);
                console.dir(elasticQuery, {depth: null});
                clauses.push(elasticQuery);
            }

            if (args.sort) {
                sort = parser.parseSort(args.sort);
            }

            let hits = await Modules.Search.elastic.client.search({
                index: 'feed-channel',
                type: 'feed-channel',
                size: args.first,
                from: args.after ? parseInt(args.after, 10) : 0,
                body: {
                    sort: sort || [{createdAt: 'desc'}], query: {bool: {must: clauses}},
                },
            });

            let channels: (FeedChannel | null)[] = await Promise.all(hits.hits.hits.map((v) => Store.FeedChannel.findById(ctx, parseInt(v._id, 10))));
            let offset = 0;
            if (args.after) {
                offset = parseInt(args.after, 10);
            }
            let total = hits.hits.total;

            return {
                edges: channels.filter(c => !!c).map((p, i) => {
                    return {
                        node: p, cursor: (i + 1 + offset).toString(),
                    };
                }), pageInfo: {
                    hasNextPage: (total - (offset + 1)) >= args.first, // ids.length === this.limitValue,
                    hasPreviousPage: false,

                    itemsCount: total,
                    pagesCount: Math.min(Math.floor(8000 / args.first), Math.ceil(total / args.first)),
                    currentPage: Math.floor(offset / args.first) + 1,
                    openEnded: true,
                },
            };
        }),
        alphaRecommendedChannels: withUser(async (ctx, args, uid) => {
            let sort: any[] | undefined = undefined;

            let parser = new QueryParser();
            parser.registerPrefix('title', 'title');
            parser.registerBoolean('isService', 'isService');
            parser.registerText('createdAt', 'createdAt');
            parser.registerText('updatedAt', 'updatedAt');

            let subscriptions = await Modules.Feed.findSubscriptions(ctx, 'user-' + uid);
            let topics: FeedTopic[] = (await Promise.all(subscriptions.map(tid => Store.FeedTopic.findById(ctx, tid)))).filter(t => !!t) as FeedTopic[];
            let channelIds = topics.filter(t => t.key.startsWith('channel-')).map(t => parseInt(t.key.replace('channel-', ''), 10));
            let hits = await Modules.Search.elastic.client.search({
                index: 'feed-channel',
                type: 'feed-channel',
                size: args.first,
                from: args.after ? parseInt(args.after, 10) : 0,
                body: {
                    sort: sort || [{subscribersCount: 'desc'}],
                    query: { bool: { must_not: [{terms: {channelId: channelIds}}] } },
                },
            });
            let channels: (FeedChannel | null)[] = await Promise.all(hits.hits.hits.map((v) => Store.FeedChannel.findById(ctx, parseInt(v._id, 10))));
            let offset = 0;
            if (args.after) {
                offset = parseInt(args.after, 10);
            }
            let total = hits.hits.total;

            return {
                edges: channels.filter(c => !!c).map((p, i) => {
                    return {
                        node: p, cursor: (i + 1 + offset).toString(),
                    };
                }), pageInfo: {
                    hasNextPage: (total - (offset + 1)) >= args.first, // ids.length === this.limitValue,
                    hasPreviousPage: false,

                    itemsCount: total,
                    pagesCount: Math.min(Math.floor(8000 / args.first), Math.ceil(total / args.first)),
                    currentPage: Math.floor(offset / args.first) + 1,
                    openEnded: true,
                },
            };
        }),
        alphaFeedChannelSubscribers: withUser(async (ctx, args, uid) => {
            let channelId = IDs.FeedChannel.parse(args.channelId);
            let topic = await Modules.Feed.resolveTopic(ctx, 'channel-' + channelId);
            let subscriptions = (await Store.FeedSubscription.topic.findAll(ctx, topic.id)).filter(s => s.enabled);
            let subscribers: FeedSubscriber[] = (await Promise.all(subscriptions.map(s => Store.FeedSubscriber.findById(ctx, s.sid)))).filter(s => !!s) as FeedSubscriber[];
            let users: number[] = [];
            for (let subscriber of subscribers) {
                if (subscriber.key.includes('user-')) {
                    users.push(parseInt(subscriber.key.replace('user-', ''), 10));
                }
            }

            let {uids, total} = await Modules.Users.searchForUsers(ctx, args.query || '', { uid: ctx.auth.uid, limit: args.first, after: (args.after || undefined), uids: users });

            if (uids.length === 0) {
                return {
                    edges: [],
                    pageInfo: {
                        hasNextPage: false,
                        hasPreviousPage: false,

                        itemsCount: 0,
                        pagesCount: 0,
                        currentPage: 0,
                        openEnded: false
                    },
                };
            }

            // Fetch profiles
            let _users = (await Promise.all(uids.map((v) => Store.User.findById(ctx, v)))).filter(u => u);
            let offset = 0;
            if (args.after) {
                offset = parseInt(args.after, 10);
            }

            return {
                edges: _users.map((p, i) => {
                    return {
                        node: { channelId, user: p },
                        cursor: (i + 1 + offset).toString()
                    };
                }),
                pageInfo: {
                    hasNextPage: (total - (offset + 1)) >= args.first, // ids.length === this.limitValue,
                    hasPreviousPage: false,

                    itemsCount: total,
                    pagesCount: Math.min(Math.floor(8000 / args.first), Math.ceil(total / args.first)),
                    currentPage: Math.floor(offset / args.first) + 1,
                    openEnded: true
                },
            };
        }),
    },
    Mutation: {
        alphaCreateFeedPost: withUser(async (ctx, args, uid) => {
            return await Modules.Feed.createPostInChannel(
                ctx,
                IDs.FeedChannel.parse(args.channel),
                uid,
                {...await resolveRichMessageCreation(ctx, args), repeatKey: args.repeatKey}
            );
        }),
        alphaEditFeedPost: withUser(async (ctx, args, uid) => {
            return await Modules.Feed.editPostInChannel(ctx, uid, IDs.FeedItem.parse(args.feedItemId), await resolveRichMessageCreation(ctx, args));
        }),
        alphaDeleteFeedPost: withUser(async (ctx, args, uid) => {
            return await Modules.Feed.deletePostInChannel(ctx, uid, IDs.FeedItem.parse(args.feedItemId));
        }),
        feedReactionAdd: withUser(async (ctx, args, uid) => {
            return await Modules.Feed.setReaction(ctx, uid, IDs.FeedItem.parse(args.feedItemId), args.reaction);
        }),
        feedReactionRemove: withUser(async (ctx, args, uid) => {
            return await Modules.Feed.setReaction(ctx, uid, IDs.FeedItem.parse(args.feedItemId), args.reaction, true);
        }),

        alphaFeedCreateChannel: withUser(async (root, args, uid) => {
            return inTx(root, async ctx => {
                if (args.photoRef) {
                    await Modules.Media.saveFile(ctx, args.photoRef.uuid);
                }
                if (args.socialImageRef) {
                    await Modules.Media.saveFile(ctx, args.socialImageRef.uuid);
                }
                return await Modules.Feed.createFeedChannel(ctx, uid, {
                    title: args.title,
                    about: args.about || undefined,
                    image: args.photoRef || undefined,
                    socialImage: args.socialImageRef || undefined,
                    global: args.global || undefined
                });
            });
        }),
        alphaFeedUpdateChannel: withUser(async (root, args, uid) => {
            return inTx(root, async ctx => {
                if (args.photoRef) {
                    await Modules.Media.saveFile(ctx, args.photoRef.uuid);
                }
                if (args.socialImageRef) {
                    await Modules.Media.saveFile(ctx, args.socialImageRef.uuid);
                }
                return await Modules.Feed.updateFeedChannel(ctx, IDs.FeedChannel.parse(args.id), uid, {
                    title: args.title,
                    about: args.about || undefined,
                    image: args.photoRef || undefined,
                    global: args.global || undefined
                });
            });
        }),

        alphaFeedChannelSubscribe: withUser(async (ctx, args, uid) => {
            await Modules.Feed.subscribeChannel(ctx, uid, IDs.FeedChannel.parse(args.id));
            return true;
        }),
        alphaFeedChannelUnsubscribe: withUser(async (ctx, args, uid) => {
            await Modules.Feed.unsubscribeChannel(ctx, uid, IDs.FeedChannel.parse(args.id));
            return true;
        }),

        alphaFeedChannelAddEditor: withUser(async (ctx, args, uid) => {
            await Modules.Feed.addEditor(ctx, IDs.FeedChannel.parse(args.id), IDs.User.parse(args.userId), uid);
            return true;
        }),
        alphaFeedChannelRemoveEditor: withUser(async (ctx, args, uid) => {
            await Modules.Feed.removeEditor(ctx, IDs.FeedChannel.parse(args.id), IDs.User.parse(args.userId), uid);
            return true;
        }),
    }
} as GQLResolver;