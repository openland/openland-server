import { FeedEvent, RichMessage } from './../openland-module-db/store';
import { GQLResolver } from 'openland-module-api/schema/SchemaSpec';
import { withUser } from 'openland-module-api/Resolvers';
import { Modules } from 'openland-modules/Modules';
import { Store } from 'openland-module-db/FDB';
import { IDs } from 'openland-module-api/IDs';
import { CommentSpan } from '../openland-module-comments/repositories/CommentsRepository';
import { MessageAttachmentFileInput } from '../openland-module-messaging/MessageInput';
import { GQLRoots } from '../openland-module-api/schema/SchemaRoots';
import FeedItemContentRoot = GQLRoots.FeedItemContentRoot;

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
    Query: {
        alphaHomeFeed: withUser(async (ctx, args, uid) => {
            let allUids = Array.from(new Set(['user-' + uid, ...(await Store.UserEdge.forward.findAll(ctx, uid)).map((v) => 'user-' + v.uid2)]));

            let subscriptions = await Promise.all(allUids.map((v) => Modules.Feed.resolveTopic(ctx, v)));
            let globalTag = await Modules.Feed.resolveTopic(ctx, 'tag-global');
            subscriptions.push(globalTag);
            // let subscriptions = await Modules.Feed.findSubscriptions(ctx, 'user-' + uid);
            let allEvents: FeedEvent[] = [];
            for (let s of subscriptions) {
                for (let t of await Store.FeedEvent.topic.findAll(ctx, s.id)) {
                    allEvents.push(t);
                }
            }
            allEvents = allEvents.sort((a, b) => b.id - a.id);
            return allEvents;
        })
    },
    Mutation: {
        alphaCreateFeedPost: withUser(async (ctx, args, uid) => {
            return Modules.Feed.createEvent(ctx, 'user-' + uid, 'post', { text: args.message, uid });
        }),
        alphaCreateGlobalFeedPost: withUser(async (ctx, args, uid) => {
            let spans: CommentSpan[] = [];

            //
            // Mentions
            //
            if (args.mentions) {
                let mentions: CommentSpan[] = [];

                for (let mention of args.mentions) {
                    if (mention.userId) {
                        mentions.push({
                            type: 'user_mention',
                            offset: mention.offset,
                            length: mention.length,
                            user: IDs.User.parse(mention.userId!)
                        });
                    } else if (mention.chatId) {
                        mentions.push({
                            type: 'room_mention',
                            offset: mention.offset,
                            length: mention.length,
                            room: IDs.Conversation.parse(mention.chatId!)
                        });
                    } else if (mention.userIds) {
                        mentions.push({
                            type: 'multi_user_mention',
                            offset: mention.offset,
                            length: mention.length,
                            users: mention.userIds.map(id => IDs.User.parse(id))
                        });
                    } else if (mention.all) {
                        mentions.push({
                            type: 'all_mention',
                            offset: mention.offset,
                            length: mention.length,
                        });
                    }
                }

                spans.push(...mentions);
            }

            //
            // File attachments
            //
            let attachments: MessageAttachmentFileInput[] = [];
            if (args.fileAttachments) {
                for (let fileInput of args.fileAttachments) {
                    let fileMetadata = await Modules.Media.saveFile(ctx, fileInput.fileId);
                    let filePreview: string | null = null;

                    if (fileMetadata.isImage) {
                        filePreview = await Modules.Media.fetchLowResPreview(ctx, fileInput.fileId);
                    }

                    attachments.push({
                        type: 'file_attachment',
                        fileId: fileInput.fileId,
                        fileMetadata: fileMetadata || null,
                        filePreview: filePreview || null
                    });
                }
            }

            //
            //  Spans
            //
            if (args.spans) {
                for (let span of args.spans) {
                    if (span.type === 'Bold') {
                        spans.push({ offset: span.offset, length: span.length, type: 'bold_text' });
                    } else if (span.type === 'Italic') {
                        spans.push({ offset: span.offset, length: span.length, type: 'italic_text' });
                    } else if (span.type === 'InlineCode') {
                        spans.push({ offset: span.offset, length: span.length, type: 'inline_code_text' });
                    } else if (span.type === 'CodeBlock') {
                        spans.push({ offset: span.offset, length: span.length, type: 'code_block_text' });
                    } else if (span.type === 'Irony') {
                        spans.push({ offset: span.offset, length: span.length, type: 'irony_text' });
                    } else if (span.type === 'Insane') {
                        spans.push({ offset: span.offset, length: span.length, type: 'insane_text' });
                    } else if (span.type === 'Loud') {
                        spans.push({ offset: span.offset, length: span.length, type: 'loud_text' });
                    } else if (span.type === 'Rotating') {
                        spans.push({ offset: span.offset, length: span.length, type: 'rotating_text' });
                    }
                }
            }

            await Modules.Feed.createPost(ctx, uid, 'tag-global', {
                message: args.message,
                attachments,
                spans,
            });

            return true;
        }),
    }
} as GQLResolver;