import { IDs, IdsFactory } from './utils/IDs';
import { buildBaseImageUrl } from '../repositories/Media';
import { withUser, withAccount, withAny, withPermission } from './utils/Resolvers';
import { Repos } from '../repositories';
import { ImageRef } from '../repositories/Media';
import { CallContext } from './utils/CallContext';
import { UserError } from '../errors/UserError';
import { ErrorText } from '../errors/ErrorText';
import { NotFoundError } from '../errors/NotFoundError';
import { Sanitizer } from '../modules/Sanitizer';
import { buildElasticQuery, QueryParser } from '../modules/QueryParser';
import {
    defined, emailValidator, stringNotEmpty,
    validate
} from '../modules/NewInputValidator';
import { AccessDeniedError } from '../errors/AccessDeniedError';
import { Emails } from '../services/Emails';
import { Services } from '../services';
import { Modules } from 'openland-modules/Modules';
import { inTx } from 'foundation-orm/inTx';
import { FDB } from 'openland-module-db/FDB';
import { Organization } from 'openland-module-db/schema';

interface AlphaOrganizationsParams {
    query?: string;
    prefix?: string;
    first: number;
    after?: string;
    page?: number;
    sort?: string;
}

export const Resolver = {
    OrganizationProfile: {
        id: (src: Organization) => IDs.Organization.serialize(src.id!!),
        name: async (src: Organization) => ((await FDB.OrganizationProfile.findById(src.id!!)))!.name,
        photoRef: async (src: Organization) => ((await FDB.OrganizationProfile.findById(src.id!!)))!.photo,

        website: async (src: Organization) => ((await FDB.OrganizationProfile.findById(src.id!!)))!.website,
        websiteTitle: (src: Organization) => null,
        about: async (src: Organization) => ((await FDB.OrganizationProfile.findById(src.id!!)))!.about,
        twitter: async (src: Organization) => ((await FDB.OrganizationProfile.findById(src.id!!)))!.twitter,
        facebook: async (src: Organization) => ((await FDB.OrganizationProfile.findById(src.id!!)))!.facebook,
        linkedin: async (src: Organization) => ((await FDB.OrganizationProfile.findById(src.id!!)))!.linkedin,

        alphaPublished: async (src: Organization) => ((await FDB.OrganizationEditorial.findById(src.id!!)))!.listed,
        alphaEditorial: (src: Organization) => src.editorial,
        alphaFeatured: async (src: Organization) => ((await FDB.OrganizationEditorial.findById(src.id!!)))!.featured,
        alphaIsCommunity: (src: Organization) => src.kind === 'community',

        alphaOrganizationType: (src: Organization) => [],

        alphaJoinedChannels: async (src: Organization) => {
            return [];
        },
        alphaCreatedChannels: async (src: Organization) => {
            return [];
        }
    },

    Organization: {
        id: (src: Organization) => IDs.Organization.serialize(src.id!!),
        superAccountId: (src: Organization) => IDs.SuperAccount.serialize(src.id!!),
        isMine: (src: Organization, args: {}, context: CallContext) => Repos.Organizations.isMemberOfOrganization(src.id!!, context.uid!!),
        alphaIsOwner: (src: Organization, args: {}, context: CallContext) => Repos.Organizations.isOwnerOfOrganization(src.id!!, context.uid!!),

        name: async (src: Organization) => ((await FDB.OrganizationProfile.findById(src.id!!)))!.name,
        photo: async (src: Organization) => buildBaseImageUrl(((await FDB.OrganizationProfile.findById(src.id!!)))!.photo),
        photoRef: async (src: Organization) => ((await FDB.OrganizationProfile.findById(src.id!!)))!.photo,

        website: async (src: Organization) => ((await FDB.OrganizationProfile.findById(src.id!!)))!.website,
        websiteTitle: (src: Organization) => null,
        about: async (src: Organization) => ((await FDB.OrganizationProfile.findById(src.id!!)))!.about,
        twitter: async (src: Organization) => ((await FDB.OrganizationProfile.findById(src.id!!)))!.twitter,
        facebook: async (src: Organization) => ((await FDB.OrganizationProfile.findById(src.id!!)))!.facebook,
        linkedin: async (src: Organization) => ((await FDB.OrganizationProfile.findById(src.id!!)))!.linkedin,

        alphaContacts: async (src: Organization) => [], // (await Repos.Organizations.getOrganizationContacts(src.id!!)).map(async (m) => await Modules.Users.profileById(m.uid)).filter(p => p),
        alphaOrganizationMembers: async (src: Organization) => await Repos.Organizations.getOrganizationJoinedMembers(src.id!!),
        alphaPublished: async (src: Organization) => ((await FDB.OrganizationEditorial.findById(src.id!!)))!.listed,
        alphaEditorial: (src: Organization) => src.editorial,
        alphaFeatured: async (src: Organization) => ((await FDB.OrganizationEditorial.findById(src.id!!)))!.featured,
        alphaIsCommunity: (src: Organization) => src.kind === 'community',

        alphaOrganizationType: (src: Organization) => [],

        alphaFollowed: async (src: Organization, args: {}, context: CallContext) => {
            return false;
        },

        alphaCreatedChannels: async (src: Organization) => {
            return FDB.ConversationRoom.allFromOrganizationPublicRooms(src.id!);
        },
        shortname: async (src: Organization) => {
            let shortName = await Modules.Shortnames.findOrganizationShortname(src.id!);

            if (shortName) {
                return shortName.shortname;
            }

            return null;
        }
    },

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
    Mutation: {
        createOrganization: withUser<{
            input: {
                name: string,
                website?: string | null
                personal: boolean
                photoRef?: ImageRef | null
                about?: string
                isCommunity?: boolean
            }
        }>(async (args, uid) => {
            return await Repos.Organizations.createOrganization(uid, args.input);
        }),
        alphaAlterPublished: withPermission<{ id: string, published: boolean }>(['super-admin', 'editor'], async (args) => {
            return await inTx(async () => {
                let org = await FDB.Organization.findById(IDs.Organization.parse(args.id));
                if (!org) {
                    throw new UserError(ErrorText.unableToFindOrganization);
                }
                let editorial = await FDB.OrganizationEditorial.findById(org.id);
                editorial!.listed = args.published;
                return org;
            });
        }),
        updateOrganizationProfile: withAccount<{
            input: {
                name?: string | null,
                photoRef?: ImageRef | null,

                website?: string | null
                websiteTitle?: string | null
                about?: string | null
                twitter?: string | null
                facebook?: string | null
                linkedin?: string | null
                location?: string | null

                contacts?: {
                    name: string
                    photoRef?: ImageRef | null
                    position?: string | null
                    email?: string | null
                    phone?: string | null
                    link?: string | null
                }[] | null

                alphaPublished?: boolean | null;
                alphaEditorial?: boolean | null;
                alphaFeatured?: boolean | null;

                alphaOrganizationType?: string[] | null
            },
            id?: string;
        }>(async (args, uid, oid) => {

            let orgId = oid;
            if (args.id) {
                let role = await Repos.Permissions.superRole(uid);
                if (!(role === 'super-admin' || role === 'editor')) {
                    throw new UserError(ErrorText.permissionOnlyOwner);
                }
                orgId = IDs.Organization.parse(args.id);
            } else {
                let member = await FDB.OrganizationMember.findById(oid, uid);
                if (member === null || member.status !== 'joined' || member.role !== 'admin') {
                    throw new UserError(ErrorText.permissionOnlyOwner);
                }
            }

            return await inTx(async () => {
                let existing = await FDB.Organization.findById(orgId);
                if (!existing) {
                    throw new UserError(ErrorText.unableToFindOrganization);
                }

                let profile = (await FDB.OrganizationProfile.findById(orgId))!;

                if (args.input.name !== undefined) {
                    await validate(
                        stringNotEmpty('Name can\'t be empty!'),
                        args.input.name,
                        'input.name'
                    );
                    profile.name = Sanitizer.sanitizeString(args.input.name)!;
                }
                if (args.input.website !== undefined) {
                    profile.website = Sanitizer.sanitizeString(args.input.website);
                }
                if (args.input.photoRef !== undefined) {
                    if (args.input.photoRef !== null) {
                        await Services.UploadCare.saveFile(args.input.photoRef.uuid);
                    }
                    profile.photo = Sanitizer.sanitizeImageRef(args.input.photoRef);
                }

                if (args.input.twitter !== undefined) {
                    profile.twitter = Sanitizer.sanitizeString(args.input.twitter);
                }
                if (args.input.facebook !== undefined) {
                    profile.facebook = Sanitizer.sanitizeString(args.input.facebook);
                }
                if (args.input.linkedin !== undefined) {
                    profile.linkedin = Sanitizer.sanitizeString(args.input.linkedin);
                }
                if (args.input.about !== undefined) {
                    profile.about = Sanitizer.sanitizeString(args.input.about);
                }

                let editorial = (await FDB.OrganizationEditorial.findById(oid))!;

                if (args.input.alphaPublished !== undefined) {
                    editorial.listed = Sanitizer.sanitizeAny(args.input.alphaPublished) ? true : false;
                }

                if (args.input.alphaEditorial !== undefined) {
                    existing.editorial = Sanitizer.sanitizeAny(args.input.alphaEditorial) ? true : false;
                }

                if (args.input.alphaFeatured !== undefined) {
                    editorial.featured = Sanitizer.sanitizeAny(args.input.alphaFeatured) || false;
                }

                return existing;
            });
        }),
        alphaFollowOrganization: withAccount<{ id: string, follow: boolean }>(async (args, uid, oid) => {
            // let orgId = IDs.Organization.parse(args.id);
            // if (orgId === oid) {
            //     throw new UserError('Unable to follow your own organization');
            // }
            // return await DB.tx(async (tx) => {
            //     let existing = await DB.OrganizationConnect.find({
            //         where: {
            //             initiatorOrgId: oid,
            //             targetOrgId: orgId
            //         },
            //         transaction: tx,
            //         lock: tx.LOCK.UPDATE
            //     });
            //     let newStatus: 'FOLLOWING' | 'NOT_FOLLOWING' = args.follow ? 'FOLLOWING' : 'NOT_FOLLOWING';
            //     if (existing) {
            //         existing.followStatus = newStatus;
            //         await existing.save({ transaction: tx });
            //     } else {
            //         await DB.OrganizationConnect.create({
            //             initiatorOrgId: oid,
            //             targetOrgId: orgId,
            //             followStatus: newStatus,
            //         }, { transaction: tx });
            //     }
            //     return await DB.Organization.findById(orgId, { transaction: tx });
            // });
            throw Error('Follow is not supported');
        }),

        alphaOrganizationRemoveMember: withAccount<{ memberId: string, organizationId: string }>(async (args, uid, oid) => {
            oid = args.organizationId ? IDs.Organization.parse(args.organizationId) : oid;
            return await inTx(async () => {
                let isOwner = await Repos.Organizations.isOwnerOfOrganization(oid, uid);

                let idType = IdsFactory.resolve(args.memberId);

                if (idType.type.typeName === 'User') {
                    let memberId = IDs.User.parse(args.memberId);

                    let member = await FDB.OrganizationMember.findById(oid, memberId);

                    if (!member) {
                        return 'ok';
                    }

                    let invitedByUser = (member.invitedBy && (member.invitedBy === uid)) || false;

                    if (!isOwner && !invitedByUser) {
                        throw new AccessDeniedError(ErrorText.permissionDenied);
                    }

                    if (isOwner && (memberId === uid)) {
                        throw new AccessDeniedError(ErrorText.permissionDenied);
                    }

                    member.status = 'left';

                    // await Emails.sendMemberRemovedEmail(oid, memberId, tx);
                    // pick new primary organization

                    let user = (await Modules.Users.profileById(memberId))!;
                    user.primaryOrganization = (await Repos.Users.fetchUserAccounts(uid))[0];
                }

                return 'ok';
            });
        }),

        alphaOrganizationChangeMemberRole: withAccount<{ memberId: string, newRole: 'OWNER' | 'MEMBER', organizationId: string }>(async (args, uid, oid) => {
            oid = args.organizationId ? IDs.Organization.parse(args.organizationId) : oid;

            return await inTx(async () => {
                let isOwner = await Repos.Organizations.isOwnerOfOrganization(oid, uid);

                if (!isOwner) {
                    throw new UserError(ErrorText.permissionOnlyOwner);
                }

                let idType = IdsFactory.resolve(args.memberId);

                if (idType.type.typeName === 'User') {
                    let memberId = IDs.User.parse(args.memberId);

                    if (memberId === uid) {
                        throw new AccessDeniedError(ErrorText.permissionDenied);
                    }

                    let member = await FDB.OrganizationMember.findById(memberId, oid);

                    if (!member) {
                        throw new NotFoundError();
                    }

                    switch (args.newRole) {
                        case 'OWNER':
                            member.role = 'admin';
                            break;
                        case 'MEMBER':
                            member.role = 'member';
                            break;
                        default:
                            break;
                    }
                }

                return 'ok';
            });
        }),
        alphaOrganizationInviteMembers: withAccount<{ inviteRequests: { email: string, emailText?: string, firstName?: string, lastName?: string, role: 'OWNER' | 'MEMBER' }[], organizationId?: string }>(async (args, uid, oid) => {
            oid = args.organizationId ? IDs.Organization.parse(args.organizationId) : oid;
            await validate(
                {
                    inviteRequests: [
                        {
                            email: defined(emailValidator),
                        }
                    ]
                },
                args
            );

            return await inTx(async () => {
                for (let inviteRequest of args.inviteRequests) {
                    let isMemberDuplicate = await Repos.Organizations.haveMemberWithEmail(oid, inviteRequest.email);
                    if (isMemberDuplicate) {
                        throw new UserError(ErrorText.memberWithEmailAlreadyExists);
                    }

                    let invite = await Modules.Invites.repo.createOrganizationInvite(
                        oid,
                        uid,
                        inviteRequest.firstName || '',
                        inviteRequest.lastName || '',
                        inviteRequest.email,
                        inviteRequest.emailText || '',
                        inviteRequest.role,
                    );

                    await Emails.sendInviteEmail(oid, invite);
                }
                return 'ok';
            });
        }),
        alphaOrganizationCreatePublicInvite: withAccount<{ expirationDays?: number, organizationId?: string }>(async (args, uid, oid) => {
            return inTx(async () => {
                oid = args.organizationId ? IDs.Organization.parse(args.organizationId) : oid;
                let isOwner = await Repos.Organizations.isOwnerOfOrganization(oid, uid);

                if (!isOwner) {
                    throw new UserError(ErrorText.permissionOnlyOwner);
                }

                return await Modules.Invites.repo.createPublicOrganizationInvite(oid, uid);
            });
        }),
        alphaOrganizationDeletePublicInvite: withAccount<{ organizationId?: string }>(async (args, uid, oid) => {
            oid = args.organizationId ? IDs.Organization.parse(args.organizationId) : oid;
            return inTx(async () => {
                let isOwner = await Repos.Organizations.isOwnerOfOrganization(oid, uid);

                if (!isOwner) {
                    throw new UserError(ErrorText.permissionOnlyOwner);
                }

                await Modules.Invites.repo.deletePublicOrganizationInvite(oid, uid);
                return 'ok';
            });
        })
    }
};