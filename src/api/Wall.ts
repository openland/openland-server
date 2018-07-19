import { resolveID, withAccount, withAny, withOrgOwner } from './utils/Resolvers';
import { DB } from '../tables';
import { IDs } from './utils/IDs';
import { WallPost } from '../tables/WallPost';
import { SelectBuilder } from '../modules/SelectBuilder';
import { enumString, stringNotEmpty, validate } from '../modules/NewInputValidator';

const EntityTypes: { [key: string]: string } = {
    'NEWS': 'WallPost'
};

interface PostInput {
    text: string;
    type: string;
    isPinned: boolean;
    tags: string[];
}

export const Resolver = {
    WallPost: {
        id: resolveID(IDs.WallEntity),
        creator: async (src: WallPost) => await DB.User.findById(src.creatorId),
        lastEditor: async (src: WallPost) => src.lastEditor ? await DB.User.findById(src.lastEditor) : null,
        type: (src: WallPost) => src.extras!.type || 'UNKNOWN',
        isPinned: (src: WallPost) => src.isPinned,
        tags: (src: WallPost) => src.extras!.tags || []
    },

    WallEntity: {
        __resolveType(src: WallPost) {
            return EntityTypes[src.type!];
        }
    },

    Query: {
        wallEntity: withAny<{ id: string }>(async (args) => {
            let post = await DB.WallPost.findById(IDs.WallEntity.parse(args.id));

            if (!post) {
                return null;
            }

            return post;
        }),

        wall: withAny<{ orgId: string, first: number, after?: string, page?: number }>(async (args) => {
            let builder = new SelectBuilder(DB.WallPost)
                .whereEq('orgId', IDs.Organization.parse(args.orgId))
                .orderBy('isPinned', 'DESC')
                .orderBy('createdAt')
                .after(args.after)
                .page(args.page)
                .limit(args.first);

            return builder.findAll([], {});
        }),

        wallMyOrg: withAccount<{ first: number, after?: string, page?: number }>(async (args, uid, orgId) => {
            let builder = new SelectBuilder(DB.WallPost)
                .whereEq('orgId', orgId)
                .orderBy('isPinned', 'DESC')
                .orderBy('createdAt')
                .after(args.after)
                .page(args.page)
                .limit(args.first);

            return builder.findAll([], {});
        }),
    },

    Mutation: {
        wallAddPost: withOrgOwner<{ input: PostInput }>(async (args, uid, oid) => {
            await validate(
                {
                    text: stringNotEmpty(),
                    type: enumString(['UPDATE', 'NEWS']),
                    tags: [, stringNotEmpty()]
                },
                args.input
            );

            return DB.tx(async (tx) => {
                if (args.input.isPinned === true) {
                    await DB.WallPost.update(
                        { isPinned: false },
                        { where: { orgId: oid }, transaction: tx }
                    );
                }

                return await DB.WallPost.create({
                    creatorId: uid,
                    orgId: oid,
                    text: args.input.text,
                    type: 'NEWS',
                    extras: {
                        type: args.input.type,
                        tags: args.input.tags || []
                    },
                    isPinned: args.input.isPinned
                }, { transaction: tx });
            });
        }),

        wallEditPost: withOrgOwner<{ id: string, input: PostInput }>(async (args, uid, oid) => {
            await validate(
                {
                    text: stringNotEmpty(),
                    type: enumString(['UPDATE', 'NEWS']),
                    tags: [, stringNotEmpty()]
                },
                args.input
            );

            return DB.tx(async (tx) => {
                let post = await DB.WallPost.find({
                    where: {
                        orgId: oid,
                        id: IDs.WallEntity.parse(args.id),
                        type: 'NEWS'
                    },
                    transaction: tx
                });

                if (!post) {
                    return null;
                }

                if (args.input.isPinned === true) {
                    await DB.WallPost.update(
                        { isPinned: false },
                        { where: { orgId: oid }, transaction: tx }
                    );
                }

                return await post.update(
                    {
                        text: args.input.text,
                        lastEditor: uid,
                        extras: {
                            type: args.input.type,
                            tags: args.input.tags || [],
                        }
                    },
                    { transaction: tx }
                );
            });
        }),

        wallDeleteEntity: withOrgOwner<{ id: string }>(async (args, uid, oid) => {
            await DB.WallPost.destroy({
                where: {
                    orgId: oid,
                    id: IDs.WallEntity.parse(args.id)
                }
            });

            return 'ok';
        }),

        wallPin: withOrgOwner<{ id: string }>(async (args, uid, oid) => {
            return DB.tx(async (tx) => {
                let post = await DB.WallPost.find({
                    where: {
                        orgId: oid,
                        id: IDs.WallEntity.parse(args.id)
                    },
                    transaction: tx
                });

                if (!post) {
                    return 'ok';
                }

                await DB.WallPost.update(
                    { isPinned: false },
                    { where: { orgId: oid }, transaction: tx }
                );

                await DB.WallPost.update(
                    { isPinned: true },
                    { where: { orgId: oid, id: IDs.WallEntity.parse(args.id) }, transaction: tx }
                );

                return 'ok';
            });
        }),

        wallUnpin: withOrgOwner<{ id: string }>(async (args, uid, oid) => {
            return DB.tx(async (tx) => {
                let post = await DB.WallPost.find({
                    where: {
                        orgId: oid,
                        id: IDs.WallEntity.parse(args.id)
                    },
                    transaction: tx
                });

                if (!post) {
                    return 'ok';
                }

                await DB.WallPost.update(
                    { isPinned: false },
                    { where: { orgId: oid, id: IDs.WallEntity.parse(args.id) }, transaction: tx }
                );

                return 'ok';
            });
        }),
    }
};