import { FDB } from 'openland-module-db/FDB';
import { Modules } from 'openland-modules/Modules';
import { withAny } from 'openland-module-api/Resolvers';
import { QueryParser, buildElasticQuery } from 'openland-utils/QueryParser';

interface AlphaOrganizationsParams {
    query?: string;
    prefix?: string;
    first: number;
    after?: string;
    page?: number;
    sort?: string;
}

export default {
    Query: {
        alphaOrganizationByPrefix: withAny<{ query: string }>(async args => {

            let hits = await Modules.Search.elastic.client.search({
                index: 'organization',
                type: 'organization',
                body: {
                    query: {
                        bool: {
                            must: [
                                {
                                    term: { kind: 'organization' }
                                },
                                {
                                    term: { listed: true }
                                },
                                {
                                    match_phrase_prefix: { name: args.query }
                                }
                            ]
                        }
                    }
                }
            });

            let res = hits.hits.hits.map((v) => FDB.Organization.findById(parseInt(v._id, 10)));

            return res;
        }),
        alphaComunityPrefixSearch: withAny<AlphaOrganizationsParams>(async args => {

            let clauses: any[] = [];
            clauses.push({ term: { isCommunity: true } });
            clauses.push({ term: { published: true } });
            if (args.query && args.query.length > 0) {
                clauses.push({ match_phrase_prefix: { name: args.query } });
            }

            let hits = await Modules.Search.elastic.client.search({
                index: 'organization',
                type: 'organization',
                body: {
                    query: { bool: { must: clauses } }
                }
            });

            let orgs = hits.hits.hits.map((v) => FDB.Organization.findById(parseInt(v._id, 10)));
            let offset = 0;
            if (args.after) {
                offset = parseInt(args.after, 10);
            } else if (args.page) {
                offset = (args.page - 1) * args.first;
            }
            let total = orgs.length;

            return {
                edges: orgs.map((p, i) => {
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
            // let builder = new SelectBuilder(DB.Organization)
            //     .after(args.after)
            //     .page(args.page)
            //     .limit(args.first);

            // return await builder.findElastic(hits);
        }),

        alphaOrganizations: withAny<AlphaOrganizationsParams>(async args => {
            let clauses: any[] = [];
            let sort: any[] | undefined = undefined;
            if (args.query || args.sort) {
                let parser = new QueryParser();
                parser.registerText('name', 'name');
                parser.registerText('location', 'location');
                parser.registerText('organizationType', 'organizationType');
                parser.registerText('interest', 'interest');
                parser.registerText('tag', 'tags');
                parser.registerText('createdAt', 'createdAt');
                parser.registerText('updatedAt', 'updatedAt');
                parser.registerText('featured', 'featured');

                if (args.query) {
                    let parsed = parser.parseQuery(args.query);
                    let elasticQuery = buildElasticQuery(parsed);
                    clauses.push(elasticQuery);
                }

                if (args.prefix && args.prefix.length > 0) {
                    clauses.push({ match_phrase_prefix: { name: args.prefix } });
                }

                if (args.sort) {
                    sort = parser.parseSort(args.sort);
                }
            }

            clauses.push({ term: { published: true } });
            clauses.push({ term: { isCommunity: false } });

            let hits = await Modules.Search.elastic.client.search({
                index: 'organization',
                type: 'organization',
                size: args.first,
                from: args.after ? parseInt(args.after, 10) : (args.page ? ((args.page - 1) * args.first) : 0),
                body: {
                    sort: sort,
                    query: { bool: { must: clauses } }
                }
            });

            let orgs = hits.hits.hits.map((v) => FDB.Organization.findById(parseInt(v._id, 10)));
            let offset = 0;
            if (args.after) {
                offset = parseInt(args.after, 10);
            } else if (args.page) {
                offset = (args.page - 1) * args.first;
            }
            let total = orgs.length;

            return {
                edges: orgs.map((p, i) => {
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