import { IDs } from '../../openland-module-api/IDs';
import { GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
import { Store } from '../../openland-module-db/FDB';
import { Discussion } from '../../openland-module-db/store';
import { withPermission, withUser } from '../../openland-module-api/Resolvers';
import { Modules } from '../../openland-modules/Modules';
import { inTx } from '@openland/foundationdb';
import { GQLRoots } from '../../openland-module-api/schema/SchemaRoots';
import ParagraphRoot = GQLRoots.ParagraphRoot;
import { resolveDiscussionInput } from './resolveDisussionInput';

export const Resolver: GQLResolver = {
    Discussion: {
        id: src => IDs.Discussion.serialize(src.id),
        author: src => src.uid,
        title: src => src.title,
        content: src => src.content || [],
        hub: async (src, args, ctx) => src.hubId ? (await Store.DiscussionHub.findById(ctx, src.hubId))! : null,
        createdAt: src => src.metadata.createdAt,
        updatedAt: src => src.metadata.updatedAt,
        deletedAt: src => src.archivedAt
    },

    DiscussionConnection: {
        items: src => src.items,
        cursor: src => src.cursor
    },

    Paragraph: {
        __resolveType(root: ParagraphRoot) {
            if (root.type === 'text') {
                return 'TextParagraph';
            } else if (root.type === 'image') {
                return 'ImageParagraph';
            }
            throw new Error('Unknown paragraph type ' + root);
        }
    },
    TextParagraph: {
        text: src => src.text,
        spans: src => src.spans
    },
    ImageParagraph: {
        image: src => src.image.image
    },

    Query: {
        discussion: async (_, args, ctx) => {
            return await Store.Discussion.findById(ctx, IDs.Discussion.parse(args.id));
        },
        discussions: async (_, args, ctx) => {
            // Return all discussions if no hubs provided
            if (args.hubs.length === 0) {
                let res = await Store.Discussion.publishedAll.query(ctx, {
                    limit: args.limit,
                    reverse: true,
                    after: args.after ? parseInt(IDs.DiscussionCursor.parse(args.after), 10) : null
                });

                return {
                    items: res.items,
                    cursor: res.haveMore ? IDs.DiscussionCursor.serialize(res.items[res.items.length - 1].publishedAt!.toString(10)) : null
                };
            }

            let hubIds = args.hubs.map(h => IDs.Hub.parse(h));
            let discussions = await Promise.all(hubIds.map(hub => Store.Discussion.published.query(ctx, hub, {
                limit: args.limit + 1,
                reverse: true,
                after: args.after ? parseInt(IDs.DiscussionCursor.parse(args.after), 10) : null
            })));
            let allDiscussions: Discussion[] = [];
            for (let res of discussions) {
                allDiscussions.push(...res.items);
            }
            let items = allDiscussions.sort((a, b) => b.publishedAt! - a.publishedAt!).splice(0, args.limit);
            let haveMore = allDiscussions.length > args.limit;

            return {
                items,
                cursor: items.length > 0 && haveMore ? IDs.DiscussionCursor.serialize(items[items.length - 1].publishedAt!.toString(10)) : null
            };
        },
        discussionMyDrafts: withUser(async (ctx, args, uid) => {
            let drafts = await Store.Discussion.draft.query(ctx, uid, {
                limit: args.first,
                reverse: true,
                after: args.after ? parseInt(IDs.DiscussionCursor.parse(args.after), 10) : null
            });

            return {
                items: drafts.items,
                cursor: drafts.haveMore ? IDs.DiscussionCursor.serialize(drafts.items[drafts.items.length - 1].metadata.createdAt.toString(10)) : null
            };
        })
    },

    Mutation: {
        discussionCreate: withUser(async (ctx, args, uid) => {
            return await Modules.Discussions.discussions.createDiscussion(
                ctx,
                uid,
                await resolveDiscussionInput(ctx, args.input),
                args.isDraft
            );
        }),
        discussionDraftPublish: withUser(async (ctx, args, uid) => {
            return await Modules.Discussions.discussions.publishDraftDiscussion(ctx, uid, IDs.Discussion.parse(args.draftId));
        }),
        discussionUpdate: withUser(async (ctx, args, uid) => {
            return await Modules.Discussions.discussions.editDiscussion(
                ctx,
                IDs.Discussion.parse(args.id),
                uid,
                await resolveDiscussionInput(ctx, args.input),
            );
        }),
        discussionsDropAll: withPermission(['super-admin'], async (root) => {
            return await inTx(root, async ctx => {
                let discussions = await Store.Discussion.findAll(ctx);
                for (let discussion of discussions) {
                    await discussion.delete(ctx);
                }
                return true;
            });
        })
    }
};