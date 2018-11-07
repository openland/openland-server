import { IDs } from './utils/IDs';
import { withUser, withAccount, withAny } from './utils/Resolvers';
import { Repos } from '../repositories';
import { CallContext } from './utils/CallContext';
import { ErrorText } from '../errors/ErrorText';
import { NotFoundError } from '../errors/NotFoundError';
import { buildElasticQuery, QueryParser } from '../modules/QueryParser';
import { AccessDeniedError } from '../errors/AccessDeniedError';
import { Modules } from 'openland-modules/Modules';
import { FDB } from 'openland-module-db/FDB';

interface AlphaOrganizationsParams {
    query?: string;
    prefix?: string;
    first: number;
    after?: string;
    page?: number;
    sort?: string;
}

export const Resolver = {
    OrganizationMember: {
        __resolveType(src: any) {
            return src._type;
        }
    },

    Query: {
        myOrganization: async (_: any, args: {}, context: CallContext) => {
            if (context.oid) {
                return await FDB.Organization.findById(context.oid);
            }
            return null;
        },
        myOrganizationProfile: async (_: any, args: {}, context: CallContext) => {
            if (context.oid) {
                return await FDB.Organization.findById(context.oid);
            }
            return null;
        },
        myOrganizations: async (_: any, args: {}, context: CallContext) => {
            if (context.uid) {
                return (await Promise.all((await FDB.OrganizationMember.allFromUser('joined', context.uid))
                    .map((v) => FDB.Organization.findById(v.oid))))
                    .filter((v) => v!.status !== 'suspended');
            }
            return [];
        },
        organization: withAny<{ id: string }>(async (args) => {
            let res = await FDB.Organization.findById(IDs.Organization.parse(args.id));
            if (!res) {
                throw new NotFoundError('Unable to find organization');
            }
            return res;
        }),
        organizationProfile: withAny<{ id: string }>(async (args) => {
            let res = await FDB.Organization.findById(IDs.Organization.parse(args.id));
            if (!res) {
                throw new NotFoundError('Unable to find organization');
            }
            return res;
        }),

        alphaOrganizationMembers: withAccount<{ orgId: string }>(async (args, uid, orgId) => {
            let targetOrgId = IDs.Organization.parse(args.orgId);

            let isMember = Repos.Users.isMemberOfOrganization(uid, targetOrgId);

            if (!isMember) {
                throw new AccessDeniedError(ErrorText.permissionDenied);
            }

            let result: any[] = [];

            result.push(... await Repos.Organizations.getOrganizationJoinedMembers(orgId));

            let invites = await Modules.Invites.repo.getOrganizationInvitesForOrganization(orgId);

            for (let invite of invites) {
                result.push({
                    _type: 'OrganizationIvitedMember',
                    firstName: invite.firstName || '',
                    lastName: invite.lastName || '',
                    email: invite.email,
                    role: invite.role,
                    inviteId: invite.id
                });
            }

            return result;
        }),

        alphaOrganizationByPrefix: withAny<{ query: string }>(async args => {

            let hits = await Modules.Search.elastic.client.search({
                index: 'organizations',
                type: 'organization',
                body: {
                    query: {
                        bool: {
                            must: [
                                {
                                    term: { isCommunity: false }
                                },
                                {
                                    term: { published: true }
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
                index: 'organizations',
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
                index: 'organizations',
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
        }),

        alphaOrganizationPublicInvite: withAccount<{ organizationId?: string }>(async (args, uid, organizationId) => {
            organizationId = args.organizationId ? IDs.Organization.parse(args.organizationId) : organizationId;
            return await Modules.Invites.repo.getPublicOrganizationInvite(organizationId, uid);
        }),

        alphaTopCategories: withUser(async (args, uid) => {
            return [];
        })
    },
};