import { GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
import { IDs } from '../../openland-module-api/IDs';
import { withUser } from '../../openland-module-api/Resolvers';
import { Store } from '../../openland-module-db/FDB';
import { Modules } from '../../openland-modules/Modules';
import { isDefined } from '../../openland-utils/misc';
import { Contact } from '../../openland-module-db/store';

export const Resolver: GQLResolver = {
    Contact: {
        id: src => IDs.Contact.serialize(src.contactUid),
        user: src => src.contactUid
    },
    ContactConnection: {
        items: src => src.items,
        cursor: src => src.cursor
    },

    Query: {
        myContacts: withUser(async (ctx, args, uid) => {
            let contactsAll = await Store.Contact.user.findAll(ctx, uid);

            let clauses: any[] = [];
            clauses.push({terms: {userId: contactsAll.map(c => c.contactUid)}});
            clauses.push({term: {status: 'activated'}});

            let from = 0;
            if (args.after) {
                from = IDs.ContactCursor2.parse(args.after);
            }

            let hits = await Modules.Search.elastic.client.search({
                index: 'user_profile',
                type: 'user_profile',
                size: args.first || 20,
                body: {
                    query: {bool: {must: clauses}},
                    sort: [{nameKeyword: {order: 'asc'}}]
                },
                from
            });

            let haveMore = (hits.hits.total as any).value > (from + args.first);

            let contactsMap = new Map<number, Contact>();
            contactsAll.forEach(c => contactsMap.set(c.contactUid, c));

            let uids = hits.hits.hits.map(v => parseInt(v._id, 10));
            let items = uids.map(id => contactsMap.get(id)!);

            return {
                items,
                cursor: haveMore ? IDs.ContactCursor2.serialize(from + args.first) : null,
            };
        }),
        myContactsSearch: withUser(async (ctx, args, uid) => {
            let query = args.query || '';
            let contacts = await Store.Contact.user.findAll(ctx, uid);

            let clauses: any[] = [];
            clauses.push({terms: {userId: contacts.map(c => c.contactUid)}});
            clauses.push({term: {status: 'activated'}});
            clauses.push({
                bool: {
                    should: query.trim().length > 0 ? [
                        {match_phrase_prefix: {name: {query, max_expansions: 1000}}},
                        {match_phrase_prefix: {shortName: {query, max_expansions: 1000}}}
                    ] : []
                }
            });

            let hits = await Modules.Search.elastic.client.search({
                index: 'user_profile',
                type: 'user_profile',
                size: args.first || 20,
                body: {
                    query: {bool: {must: clauses}},
                },
                from: args && args.after ? parseInt(args.after, 10) : (args && args.page ? ((args.page - 1) * (args && args.first ? args.first : 20)) : 0),
            });

            let offset = 0;
            if (args.after) {
                offset = parseInt(args.after, 10);
            } else if (args.page) {
                offset = (args.page - 1) * args.first;
            }

            let uids = hits.hits.hits.map((v) => parseInt(v._id, 10));
            let total = (hits.hits.total as any).value;

            // Fetch profiles
            let users = (await Promise.all(uids.map((v) => Store.User.findById(ctx, v)))).filter(isDefined);

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
    },

    Mutation: {
        addToContacts: withUser(async (ctx, args, uid) => {
            await Modules.Contacts.addContact(ctx, uid, IDs.User.parse(args.userId));
            return true;
        }),
        removeFromContacts: withUser(async (ctx, args, uid) => {
            return await Modules.Contacts.removeContact(ctx, uid, IDs.User.parse(args.userId));
        }),
    }
};