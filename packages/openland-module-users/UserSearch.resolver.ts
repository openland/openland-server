import { withAny } from 'openland-server/api/utils/Resolvers';
import { Modules } from 'openland-modules/Modules';
import { FDB } from 'openland-module-db/FDB';

export default {
    Query: {
        alphaProfiles: withAny<{ query: string, first: number, after: string, page: number, sort?: string }>(async (args) => {

            let uids = await Modules.Users.searchForUsers(args.query);

            if (uids.length === 0) {
                return [];
            }

            // Fetch profiles
            let users = uids.map((v) => FDB.User.findById(v));

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
};