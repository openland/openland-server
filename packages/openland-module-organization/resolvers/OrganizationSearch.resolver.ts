import { FDB } from 'openland-module-db/FDB';
import { Modules } from 'openland-modules/Modules';
import { withAny } from 'openland-module-api/Resolvers';
import { QueryParser, buildElasticQuery } from 'openland-utils/QueryParser';
import { GQLResolver } from '../../openland-module-api/schema/SchemaSpec';

export default {
    Query: {
        alphaOrganizationByPrefix: withAny(async (ctx, args) => {
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

            let res = (await Promise.all(hits.hits.hits.map((v) => FDB.Organization.findById(ctx, parseInt(v._id, 10))))).filter(r => !!r);

            return res[0];
        }),
        alphaComunityPrefixSearch: withAny(async (ctx, args) => {
            let clauses: any[] = [];
            clauses.push({ term: { kind: 'community' } });
            // clauses.push({ term: { listed: true } });
            clauses.push({ term: { status: 'activated' } });
            if (args.query && args.query.length > 0) {
                clauses.push({ match_phrase_prefix: { name: args.query } });
            } else {
                clauses.push({ term: { featured: true } });
            }

            let hits = await Modules.Search.elastic.client.search({
                index: 'organization',
                type: 'organization',
                size: args.first,
                from: args.after ? parseInt(args.after, 10) : (args.page ? ((args.page - 1) * args.first) : 0),
                body: {
                    query: { bool: { must: clauses } }
                }
            });

            let orgs = hits.hits.hits.map((v) => FDB.Organization.findById(ctx, parseInt(v._id, 10)));
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

        alphaOrganizations: withAny(async (ctx, args) => {
            let clauses: any[] = [];
            let sort: any[] | undefined = undefined;
            if (args.query || args.sort) {
                let parser = new QueryParser();
                parser.registerText('name', 'name');
                parser.registerText('shortname', 'shortname');
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

                if (args.sort) {
                    sort = parser.parseSort(args.sort);
                }
            }

            if (args.prefix && args.prefix.length > 0) {
                clauses.push({ match_phrase_prefix: { name: args.prefix } });
            }

            if (!args.all) {
                clauses.push({ term: { listed: true } });
            }

            clauses.push({ term: { kind: 'organization' } });
            clauses.push({ term: { status: 'activated' } });

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

            let orgs = hits.hits.hits.map((v) => FDB.Organization.findById(ctx, parseInt(v._id, 10)));
            let offset = 0;
            if (args.after) {
                offset = parseInt(args.after, 10);
            } else if (args.page) {
                offset = (args.page - 1) * args.first;
            }
            let total = hits.hits.total;

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
} as GQLResolver;