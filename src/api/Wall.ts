import { CallContext } from './utils/CallContext';
import { resolveID, withAny, withOrgOwner } from './utils/Resolvers';
import { DB } from '../tables';
import { IDs } from './utils/IDs';
import { WallPost } from '../tables/WallPost';
import { SelectBuilder } from '../modules/SelectBuilder';

const EntityTypes: { [key: string]: string } = {
    'UPDATE': 'WallUpdate',
    'NEWS': 'WallNews'
};

export const Resolver = {
    WallUpdate: {
        id: resolveID(IDs.WallEntity),
        creator: async (src: WallPost) => await DB.User.findById(src.creatorId)
    },

    WallNews: {
        id: resolveID(IDs.WallEntity),
        creator: async (src: WallPost) => await DB.User.findById(src.creatorId)
    },

    WallEntity: {
        __resolveType(src: WallPost) {
            return EntityTypes[src.type];
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
                .orderBy('createdAt')
                .after(args.after)
                .page(args.page)
                .limit(args.first);

            return builder.findAll([], {});
        }),
    },

    Mutation: {
        test: async (_: any, args: {}, context: CallContext) => {
            return '';
        },

        wallAddUpdate: withOrgOwner<{ input: { text: string } }>(async (args, uid, oid) => {
            return await DB.WallPost.create({
                creatorId: uid,
                orgId: oid,
                text: args.input.text,
                type: 'UPDATE'
            });
        }),

        wallAddNews: withOrgOwner<{ input: { text: string } }>(async (args, uid, oid) => {
            return await DB.WallPost.create({
                creatorId: uid,
                orgId: oid,
                text: args.input.text,
                type: 'NEWS'
            });
        }),

        wallEditUpdate: withOrgOwner<{ id: string, input: { text: string } }>(async (args, uid, oid) => {
            let post = await DB.WallPost.find({
                where: {
                    orgId: oid,
                    id: IDs.WallEntity.parse(args.id)
                }
            });

            if (!post) {
                return null;
            }

            return await post.update(args.input);
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
    }
};