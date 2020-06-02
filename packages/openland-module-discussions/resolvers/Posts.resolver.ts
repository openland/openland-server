import { IDs } from '../../openland-module-api/IDs';
import { GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
import { Store } from '../../openland-module-db/FDB';
import { Discussion } from '../../openland-module-db/store';
import { withPermission, withUser } from '../../openland-module-api/Resolvers';
import { Modules } from '../../openland-modules/Modules';
import { inTx } from '@openland/foundationdb';
import { GQLRoots } from '../../openland-module-api/schema/SchemaRoots';
import ParagraphRoot = GQLRoots.ParagraphRoot;
import { resolveDiscussionInput } from './resolvePostInput';
import { buildBaseImageUrl } from '../../openland-module-media/ImageRef';

export const Resolver: GQLResolver = {
    Post: {
        id: src => IDs.Discussion.serialize(src.id),
        author: src => src.uid,
        title: src => src.title,
        content: src => src.content || [],
        hub: async (src, args, ctx) => src.hubId ? (await Store.DiscussionHub.findById(ctx, src.hubId))! : null,
        draft: async (src, args, ctx) => {
            let draft = await Store.DiscussionDraft.findById(ctx, src.id);
            if (!ctx.auth.uid) {
                return null;
            }
            if (draft?.id === ctx.auth.uid) {
                return draft;
            }

            return null;
        },
        canEdit: (src, args, ctx) => src.uid === ctx.auth.uid,
        createdAt: src => src.metadata.createdAt,
        updatedAt: src => src.metadata.updatedAt,
        deletedAt: src => src.archivedAt
    },
    PostDraft: {
        id: src => IDs.Discussion.serialize(src.id),
        author: src => src.uid,
        title: src => src.title,
        content: src => src.content || [],
        hub: async (src, args, ctx) => src.hubId ? (await Store.DiscussionHub.findById(ctx, src.hubId))! : null,
        publishedCopy: (src, args, ctx) => Store.Discussion.findById(ctx, src.id),
        createdAt: src => src.metadata.createdAt,
        updatedAt: src => src.metadata.updatedAt,
        deletedAt: src => src.archivedAt
    },

    PostConnection: {
        items: src => src.items,
        cursor: src => src.cursor
    },
    PostDraftConnection: {
        items: src => src.items,
        cursor: src => src.cursor
    },

    Paragraph: {
        __resolveType(root: ParagraphRoot) {
            if (root.type === 'text') {
                return 'TextParagraph';
            } else if (root.type === 'image') {
                return 'ImageParagraph';
            } else if (root.type === 'h1') {
                return 'H1Paragraph';
            } else if (root.type === 'h2') {
                return 'H2Paragraph';
            }
            throw new Error('Unknown paragraph type ' + root);
        }
    },
    TextParagraph: {
        text: src => src.text,
        spans: src => src.spans
    },
    ImageParagraph: {
        url: src => buildBaseImageUrl({uuid: src.image.image.uuid, crop: src.image.image.crop || null})!,
        image: src => src.image.image,
        fileMetadata: src => src.image.info
    },
    H1Paragraph: {
        text: src => src.text
    },
    H2Paragraph: {
        text: src => src.text
    },

    Query: {
        post: async (_, args, ctx) => {
            return await Store.Discussion.findById(ctx, IDs.Discussion.parse(args.id));
        },
        postDraft: withUser(async (ctx, args, uid) => {
            let draft = await Store.DiscussionDraft.findById(ctx, IDs.Discussion.parse(args.id));
            if (draft && draft.uid === uid) {
                return draft;
            }
            return null;
        }),
        posts: async (_, args, ctx) => {
            // Return all discussions if no hubs provided
            if (!args.hubs || args.hubs.length === 0) {
                let res = await Store.Discussion.publishedAll.query(ctx, {
                    limit: args.first,
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
                limit: args.first + 1,
                reverse: true,
                after: args.after ? parseInt(IDs.DiscussionCursor.parse(args.after), 10) : null
            })));
            let allDiscussions: Discussion[] = [];
            for (let res of discussions) {
                allDiscussions.push(...res.items);
            }
            let items = allDiscussions.sort((a, b) => b.publishedAt! - a.publishedAt!).splice(0, args.first);
            let haveMore = allDiscussions.length > args.first;

            return {
                items,
                cursor: items.length > 0 && haveMore ? IDs.DiscussionCursor.serialize(items[items.length - 1].publishedAt!.toString(10)) : null
            };
        },
        postMyDrafts: withUser(async (ctx, args, uid) => {
            let drafts = await Store.DiscussionDraft.draft.query(ctx, uid, {
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
        postDraftCreate: withUser(async (ctx, args, uid) => {
            return await Modules.Discussions.discussions.createPostDraft(
                ctx,
                uid,
                await resolveDiscussionInput(ctx, args.input)
            );
        }),
        postDraftUpdate: withUser(async (ctx, args, uid) => {
            return await Modules.Discussions.discussions.editPostDraft(
                ctx,
                IDs.Discussion.parse(args.id),
                uid,
                await resolveDiscussionInput(ctx, args.input),
            );
        }),
        postDraftPublish: withUser(async (ctx, args, uid) => {
            return await Modules.Discussions.discussions.publishDraftPost(ctx, uid, IDs.Discussion.parse(args.id));
        }),
        postsDropAll: withPermission(['super-admin'], async (root) => {
            return await inTx(root, async ctx => {
                let drafts = await Store.DiscussionDraft.findAll(ctx);
                for (let draft of drafts) {
                    await draft.delete(ctx);
                }
                let discussions = await Store.Discussion.findAll(ctx);
                for (let discussion of discussions) {
                    await discussion.delete(ctx);
                }
                return true;
            });
        })
    }
};