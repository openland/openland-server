import { DB } from '../tables';
import { Organization } from '../tables/Organization';
import { IDs, IdsFactory } from './utils/IDs';
import { buildBaseImageUrl } from '../repositories/Media';
import { withUser, withAccount, withAny, withPermission } from './utils/Resolvers';
import { Repos } from '../repositories';
import { ImageRef } from '../repositories/Media';
import { CallContext } from './utils/CallContext';
import { OrganizationExtras } from '../repositories/OrganizationExtras';
import { UserError } from '../errors/UserError';
import { ErrorText } from '../errors/ErrorText';
import { NotFoundError } from '../errors/NotFoundError';
import { Sanitizer } from '../modules/Sanitizer';
import { InvalidInputError } from '../errors/InvalidInputError';
import { ElasticClient } from '../indexing';
import { buildElasticQuery, QueryParser } from '../modules/QueryParser';
import { SelectBuilder } from '../modules/SelectBuilder';
import {
    defined, emailValidator, stringNotEmpty,
    validate
} from '../modules/NewInputValidator';
import { AccessDeniedError } from '../errors/AccessDeniedError';
import { Emails } from '../services/Emails';
import { Services } from '../services';
import { Modules } from 'openland-modules/Modules';
import { inTx } from 'foundation-orm/inTx';

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
        name: (src: Organization) => src.name,
        photoRef: (src: Organization) => src.photo,

        website: (src: Organization) => src.website,
        websiteTitle: (src: Organization) => src.website,
        about: (src: Organization) => src.extras && src.extras.about,
        twitter: (src: Organization) => src.extras && src.extras.twitter,
        facebook: (src: Organization) => src.extras && src.extras.facebook,
        linkedin: (src: Organization) => src.extras && src.extras.linkedin,

        alphaPublished: (src: Organization) => !src.extras || src.extras.published !== false,
        alphaEditorial: (src: Organization) => !!(src.extras && src.extras.editorial),
        alphaFeatured: (src: Organization) => !!(src.extras && src.extras.featured),
        alphaIsCommunity: (src: Organization) => !!(src.extras && src.extras.isCommunity),

        alphaOrganizationType: (src: Organization) => src.extras && src.extras.organizationType,

        alphaJoinedChannels: async (src: Organization) => {
            return [];
        },
        alphaCreatedChannels: async (src: Organization) => {
            return DB.Conversation.findAll({
                where: {
                    type: 'channel',
                    extras: {
                        creatorOrgId: src.id
                    }
                }
            });
        }
    },

    Organization: {
        id: (src: Organization) => IDs.Organization.serialize(src.id!!),
        superAccountId: (src: Organization) => IDs.SuperAccount.serialize(src.id!!),
        isMine: (src: Organization, args: {}, context: CallContext) => Repos.Organizations.isMemberOfOrganization(src.id!!, context.uid!!),
        alphaIsOwner: (src: Organization, args: {}, context: CallContext) => Repos.Organizations.isOwnerOfOrganization(src.id!!, context.uid!!),

        name: (src: Organization) => src.name,
        photo: (src: Organization) => src.photo ? buildBaseImageUrl(src.photo) : null,
        photoRef: (src: Organization) => src.photo,

        website: (src: Organization) => src.website,
        websiteTitle: (src: Organization) => src.website,
        about: (src: Organization) => src.extras && src.extras.about,
        twitter: (src: Organization) => src.extras && src.extras.twitter,
        facebook: (src: Organization) => src.extras && src.extras.facebook,
        linkedin: (src: Organization) => src.extras && src.extras.linkedin,

        alphaContacts: async (src: Organization) => (await Repos.Organizations.getOrganizationContacts(src.id!!)).map(async (m) => await Modules.Users.profileById(m.userId)).filter(p => p),
        alphaOrganizationMembers: async (src: Organization) => await Repos.Organizations.getOrganizationJoinedMembers(src.id!!),
        alphaPublished: (src: Organization) => !src.extras || src.extras.published !== false,
        alphaEditorial: (src: Organization) => !!(src.extras && src.extras.editorial),
        alphaFeatured: (src: Organization) => !!(src.extras && src.extras.featured),
        alphaIsCommunity: (src: Organization) => !!(src.extras && src.extras.isCommunity),

        alphaOrganizationType: (src: Organization) => src.extras && src.extras.organizationType,

        alphaFollowed: async (src: Organization, args: {}, context: CallContext) => {
            return false;
        },

        alphaCreatedChannels: async (src: Organization) => {
            return DB.Conversation.findAll({
                where: {
                    type: 'channel',
                    extras: {
                        creatorOrgId: src.id
                    }
                }
            });
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
                return await DB.Organization.findById(context.oid);
            }
            return null;
        },
        myOrganizationProfile: async (_: any, args: {}, context: CallContext) => {
            if (context.oid) {
                return await DB.Organization.findById(context.oid);
            }
            return null;
        },
        myOrganizations: async (_: any, args: {}, context: CallContext) => {
            if (context.uid) {
                let allOrgs = await DB.OrganizationMember.findAll({
                    where: {
                        userId: context.uid,
                    }
                });
                return await DB.Organization.findAll({
                    where: {
                        id: {
                            $in: allOrgs.map((v) => v.orgId)
                        },
                        status: {
                            $not: 'SUSPENDED'
                        }
                    }
                });
            }
            return [];
        },
        organization: withAny<{ id: string }>(async (args) => {
            let res = await DB.Organization.findById(IDs.Organization.parse(args.id));
            if (!res) {
                throw new NotFoundError('Unable to find organization');
            }
            return res;
        }),
        organizationProfile: withAny<{ id: string }>(async (args) => {
            let res = await DB.Organization.findById(IDs.Organization.parse(args.id));
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

            let hits = await ElasticClient.search({
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
            let res = await DB.Organization.find({
                where: {
                    id: {
                        $in: hits.hits.hits.map((v) => v._id)
                    }
                },
            });

            return res;
        }),
        alphaComunityPrefixSearch: withAny<AlphaOrganizationsParams>(async args => {

            let clauses: any[] = [];
            clauses.push({ term: { isCommunity: true } });
            clauses.push({ term: { published: true } });
            if (args.query && args.query.length > 0) {
                clauses.push({ match_phrase_prefix: { name: args.query } });
            }

            let hits = await ElasticClient.search({
                index: 'organizations',
                type: 'organization',
                body: {
                    query: { bool: { must: clauses } }
                }
            });
            let builder = new SelectBuilder(DB.Organization)
                .after(args.after)
                .page(args.page)
                .limit(args.first);

            return await builder.findElastic(hits);
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

            let hits = await ElasticClient.search({
                index: 'organizations',
                type: 'organization',
                size: args.first,
                from: args.after ? parseInt(args.after, 10) : (args.page ? ((args.page - 1) * args.first) : 0),
                body: {
                    sort: sort,
                    query: { bool: { must: clauses } }
                }
            });

            let builder = new SelectBuilder(DB.Organization)
                .after(args.after)
                .page(args.page)
                .limit(args.first);

            return await builder.findElastic(hits);
        }),

        alphaOrganizationPublicInvite: withAccount<{ organizationId?: string }>(async (args, uid, organizationId) => {
            organizationId = args.organizationId ? IDs.Organization.parse(args.organizationId) : organizationId;
            return await Modules.Invites.repo.getPublicOrganizationInvite(organizationId, uid);
        }),

        alphaTopCategories: withUser(async (args, uid) => {
            let orgs = await DB.Organization.findAll({
                where: {
                    status: 'ACTIVATED',
                }
            });
            let topCategoriesMap: { [category: string]: number } = {};
            for (let org of orgs) {
                if (org.extras && org.extras.published === false) {
                    continue;
                }
                let categories = (org.extras && org.extras.organizationType) || [];
                for (let c of categories) {
                    topCategoriesMap[c] = (topCategoriesMap[c] || 0) + 1;
                }
            }
            let topCategories: { category: string, count: number }[] = [];
            for (let key of Object.keys(topCategoriesMap)) {
                topCategories.push({ category: key, count: topCategoriesMap[key] });
            }
            return topCategories.filter(c => c.count >= 3).sort((a, b) => a.count - b.count).map(c => c.category);
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
            return await DB.tx(async (tx) => {
                return await Repos.Organizations.createOrganization(uid, args.input, tx);
            });
        }),
        alphaAlterPublished: withPermission<{ id: string, published: boolean }>(['super-admin', 'editor'], async (args) => {
            return await DB.tx(async (tx) => {
                let org = await DB.Organization.find({ where: { id: IDs.Organization.parse(args.id) }, transaction: tx });
                if (!org) {
                    throw new UserError(ErrorText.unableToFindOrganization);
                }
                let extras = org.extras || {};
                extras.published = args.published;
                org.extras = extras;
                await org.save({ transaction: tx });
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
                let member = await DB.OrganizationMember.find({
                    where: {
                        orgId: oid,
                        userId: uid,
                    }
                });
                if (member === null || !member.isOwner) {
                    throw new UserError(ErrorText.permissionOnlyOwner);
                }
            }

            return await DB.tx(async (tx) => {
                let existing = await DB.Organization.find({ where: { id: orgId }, transaction: tx, lock: tx.LOCK.UPDATE });
                if (!existing) {
                    throw new UserError(ErrorText.unableToFindOrganization);
                }

                if (args.input.name !== undefined) {
                    await validate(
                        stringNotEmpty('Name can\'t be empty!'),
                        args.input.name,
                        'input.name'
                    );
                    existing.name = Sanitizer.sanitizeString(args.input.name)!;
                }
                if (args.input.website !== undefined) {
                    existing.website = Sanitizer.sanitizeString(args.input.website);
                }
                if (args.input.websiteTitle !== undefined) {
                    existing.websiteTitle = Sanitizer.sanitizeString(args.input.websiteTitle);
                }
                if (args.input.photoRef !== undefined) {
                    if (args.input.photoRef !== null) {
                        await Services.UploadCare.saveFile(args.input.photoRef.uuid);
                    }
                    existing.photo = Sanitizer.sanitizeImageRef(args.input.photoRef);
                }

                let extrasValidateError: { key: string, message: string }[] = [];
                let extras: OrganizationExtras = existing.extras || {};
                if (args.input.twitter !== undefined) {
                    extras.twitter = Sanitizer.sanitizeString(args.input.twitter);
                }
                if (args.input.facebook !== undefined) {
                    extras.facebook = Sanitizer.sanitizeString(args.input.facebook);
                }
                if (args.input.linkedin !== undefined) {
                    extras.linkedin = Sanitizer.sanitizeString(args.input.linkedin);
                }
                if (args.input.about !== undefined) {
                    extras.about = Sanitizer.sanitizeString(args.input.about);
                }

                if (args.input.alphaPublished !== undefined) {
                    extras.published = Sanitizer.sanitizeAny(args.input.alphaPublished);
                }

                if (args.input.alphaEditorial !== undefined) {
                    extras.editorial = Sanitizer.sanitizeAny(args.input.alphaEditorial);
                }

                if (args.input.alphaFeatured !== undefined) {
                    extras.featured = Sanitizer.sanitizeAny(args.input.alphaFeatured);
                }

                if (args.input.alphaOrganizationType !== undefined) {
                    extras.organizationType = Sanitizer.sanitizeAny(args.input.alphaOrganizationType);
                }

                if (extrasValidateError.length > 0) {
                    throw new InvalidInputError(extrasValidateError);
                }

                existing.extras = extras;
                await existing.save({ transaction: tx });
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
            return await DB.txStable(async (tx) => {
                let isOwner = await Repos.Organizations.isOwnerOfOrganization(oid, uid);

                let idType = IdsFactory.resolve(args.memberId);

                if (idType.type.typeName === 'User') {
                    let memberId = IDs.User.parse(args.memberId);

                    let member = await DB.OrganizationMember.findOne({
                        where: {
                            userId: memberId,
                            orgId: oid
                        },
                        transaction: tx
                    });

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

                    await member.destroy({ transaction: tx });
                    // await Emails.sendMemberRemovedEmail(oid, memberId, tx);
                    // pick new primary organization
                    await inTx(async () => {
                        let user = (await Modules.Users.profileById(memberId))!;
                        user.primaryOrganization = (await Repos.Users.fetchUserAccounts(uid, tx))[0];
                    });
                }

                return 'ok';
            });
        }),

        alphaOrganizationChangeMemberRole: withAccount<{ memberId: string, newRole: 'OWNER' | 'MEMBER', organizationId: string }>(async (args, uid, oid) => {
            oid = args.organizationId ? IDs.Organization.parse(args.organizationId) : oid;

            return await DB.tx(async (tx) => {
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

                    let member = await DB.OrganizationMember.findOne({
                        where: {
                            userId: memberId,
                            orgId: oid
                        },
                        transaction: tx
                    });

                    if (!member) {
                        throw new NotFoundError();
                    }

                    switch (args.newRole) {
                        case 'OWNER':
                            await member.update({
                                isOwner: true,
                            }, { transaction: tx });
                            break;
                        case 'MEMBER':
                            await member.update({
                                isOwner: false,
                            }, { transaction: tx });
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
            return DB.tx(async (tx) => {
                oid = args.organizationId ? IDs.Organization.parse(args.organizationId) : oid;
                let isOwner = await Repos.Organizations.isOwnerOfOrganization(oid, uid, tx);

                if (!isOwner) {
                    throw new UserError(ErrorText.permissionOnlyOwner);
                }

                return await Modules.Invites.repo.createPublicOrganizationInvite(oid, uid);
            });
        }),
        alphaOrganizationDeletePublicInvite: withAccount<{ organizationId?: string }>(async (args, uid, oid) => {
            oid = args.organizationId ? IDs.Organization.parse(args.organizationId) : oid;
            return DB.tx(async (tx) => {
                let isOwner = await Repos.Organizations.isOwnerOfOrganization(oid, uid, tx);

                if (!isOwner) {
                    throw new UserError(ErrorText.permissionOnlyOwner);
                }

                await Modules.Invites.repo.deletePublicOrganizationInvite(oid, uid);
                return 'ok';
            });
        }),

        alphaAlterMemberAsContact: withUser<{ orgId: string, memberId: string, showInContacts: boolean }>(async (args, uid) => {
            let orgId = IDs.Organization.parse(args.orgId);

            let role = await Repos.Permissions.superRole(uid);
            let canEdit = role === 'super-admin' || role === 'editor';

            let member = await DB.OrganizationMember.find({
                where: {
                    orgId: orgId,
                    userId: uid,
                }
            });
            canEdit = canEdit || (member !== null && member.isOwner);

            if (!canEdit) {
                throw new UserError(ErrorText.permissionOnlyOwner);
            }

            let targetMember = await DB.OrganizationMember.find({
                where: {
                    orgId: orgId,
                    userId: IDs.User.parse(args.memberId),
                }
            });

            if (!targetMember) {
                throw new UserError(ErrorText.unableToFindUser);
            }

            targetMember.showInContacts = args.showInContacts;
            await targetMember.save();
            return 'ok';
        }),
    }
};