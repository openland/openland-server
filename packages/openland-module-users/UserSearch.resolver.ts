import { withAny } from 'openland-module-api/Resolvers';
import { Modules } from 'openland-modules/Modules';
import { FDB } from 'openland-module-db/FDB';
import { GQL, GQLResolver } from '../openland-module-api/schema/SchemaSpec';

export default {
    Query: {
        userSearch: withAny<GQL.QueryUserSearchArgs>(async (ctx, args) => {

            let uids = await Modules.Users.searchForUsers(ctx, args.query || '', { uid: ctx.auth.uid });

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
            let users = uids.map((v) => FDB.User.findById(ctx, v));

            let offset = 0;
            if (args.after) {
                offset = parseInt(args.after, 10);
            } else if (args.page) {
                offset = (args.page - 1) * args.first;
            }
            let total = users.length;

            return {
                edges: users.map((p, i) => {
                    return {
                        node: p,
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
        alphaProfiles: withAny<GQL.QueryAlphaProfilesArgs>(async (ctx, args) => {

            let uids = await Modules.Users.searchForUsers(ctx, args.query || '', { uid: ctx.auth.uid });

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
            let users = uids.map((v) => FDB.User.findById(ctx, v));

            let offset = 0;
            if (args.after) {
                offset = parseInt(args.after, 10);
            } else if (args.page) {
                offset = (args.page - 1) * args.first;
            }
            let total = users.length;

            return {
                edges: users.map((p, i) => {
                    return {
                        node: p,
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
        })
    }
} as GQLResolver;