import { withAccount, withAny } from 'openland-module-api/Resolvers';
import { Modules } from 'openland-modules/Modules';
import { Store } from 'openland-module-db/FDB';
import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { IDs } from '../openland-module-api/IDs';

export const Resolver: GQLResolver = {
    Query: {
        userSearch: withAny(async (ctx, args) => {

            let {uids, total} = await Modules.Users.searchForUsers(ctx, args.query || '', { uid: ctx.auth.uid, limit: args.first, page: (args.page || undefined), after: (args.after || undefined) });

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
            let users = (await Promise.all(uids.map((v) => Store.User.findById(ctx, v)))).filter(u => u);

            let offset = 0;
            if (args.after) {
                offset = parseInt(args.after, 10);
            } else if (args.page) {
                offset = (args.page - 1) * args.first;
            }

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
        userSearchForChat: withAccount(async (ctx, args, uid, oid) => {
            let cid = IDs.Conversation.parse(args.chatId);
            await Modules.Messaging.room.checkAccess(ctx, uid, cid);

            let {uids, total} = await Modules.Users.searchForUsers(ctx, args.query || '', { uid: ctx.auth.uid, limit: args.first, page: (args.page || undefined), after: (args.after || undefined) });

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
            let users = (await Promise.all(uids.map((v) => Store.User.findById(ctx, v)))).filter(u => u);

            let offset = 0;
            if (args.after) {
                offset = parseInt(args.after, 10);
            } else if (args.page) {
                offset = (args.page - 1) * args.first;
            }

            return {
                edges: await Promise.all(users.map(async (p, i) => {
                    return {
                        node: p,
                        cursor: (i + 1 + offset).toString(),
                        isMember: await Modules.Messaging.room.isRoomMember(ctx, p!.id, cid)
                    };
                })),
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
        alphaProfiles: withAny(async (ctx, args) => {

            let {uids, total} = await Modules.Users.searchForUsers(ctx, args.query || '', { uid: ctx.auth.uid });

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
            let users = (await Promise.all(uids.map((v) => Store.User.findById(ctx, v)))).filter(u => u);

            let offset = 0;
            if (args.after) {
                offset = parseInt(args.after, 10);
            } else if (args.page) {
                offset = (args.page - 1) * args.first;
            }

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
};
