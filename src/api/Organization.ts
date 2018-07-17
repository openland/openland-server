import { DB } from '../tables';
import { Organization } from '../tables/Organization';
import { IDs, IdsFactory } from './utils/IDs';
import { buildBaseImageUrl } from '../repositories/Media';
import { withUser, withAccount, withAny, withPermission } from './utils/Resolvers';
import { Repos } from '../repositories';
import { ImageRef } from '../repositories/Media';
import { CallContext } from './utils/CallContext';
import { OrganizationExtras, ContactPerson, Range, ListingExtras, DummyPost } from '../repositories/OrganizationExtras';
import { UserError } from '../errors/UserError';
import { ErrorText } from '../errors/ErrorText';
import { NotFoundError } from '../errors/NotFoundError';
import { Sanitizer } from '../modules/Sanitizer';
import { InvalidInputError } from '../errors/InvalidInputError';
import { OrganizationListing } from '../tables/OrganizationListing';
import { ElasticClient } from '../indexing';
import { buildElasticQuery, QueryParser } from '../modules/QueryParser';
import { SelectBuilder } from '../modules/SelectBuilder';
import {
    defined, emailValidator, enumString, optional, stringNotEmpty,
    validate
} from '../modules/NewInputValidator';
import { AccessDeniedError } from '../errors/AccessDeniedError';
import { Emails } from '../services/Emails';
import { Hooks } from '../repositories/Hooks';

let isFollowed = async (initiatorOrgId: number, targetOrgId: number) => {
    let connection = await DB.OrganizationConnect.find({
        where: {
            initiatorOrgId: initiatorOrgId,
            targetOrgId: targetOrgId
        }
    });

    return !!(connection && connection.followStatus === 'FOLLOWING');
};

interface AlphaOrganizationListingsParams {
    orgId: string;
    query?: string;
    first: number;
    after?: string;
    page?: number;
}

interface AlphaOrganizationsParams {
    query?: string;
    first: number;
    after?: string;
    page?: number;
}

export const Resolver = {
    OrganizationProfile: {
        id: (src: Organization) => IDs.Organization.serialize(src.id!!),
        name: (src: Organization) => src.name,
        photoRef: (src: Organization) => src.photo,

        website: (src: Organization) => src.website,
        about: (src: Organization) => src.extras && src.extras.about,
        twitter: (src: Organization) => src.extras && src.extras.twitter,
        facebook: (src: Organization) => src.extras && src.extras.facebook,
        linkedin: (src: Organization) => src.extras && src.extras.linkedin,
        location: (src: Organization) => src.extras && src.extras.location,
        contacts: (src: Organization) => src.extras ? src.extras.contacts || [] : [],

        alphaPublished: (src: Organization) => !src.extras || src.extras.published !== false,

        alphaOrganizationType: (src: Organization) => src.extras && src.extras.organizationType,
        alphaLocations: (src: Organization) => src.extras && src.extras.locations,
        alphaInterests: (src: Organization) => src.extras && src.extras.interests,
        alphaDummyPosts: (src: Organization) => src.extras && src.extras.dummyPosts,

        alphaListingDevelopmentOportunities: (src: Organization) => DB.OrganizationListing.findAll({ where: { orgId: src.id, type: 'development_opportunity' }, order: [['updatedAt', 'DESC']] }),
        alphaListingAcquisitionRequests: (src: Organization) => DB.OrganizationListing.findAll({ where: { orgId: src.id, type: 'acquisition_request' }, order: [['updatedAt', 'DESC']] }),
        alphaListingsAll: (src: Organization) => DB.OrganizationListing.findAll({ where: { orgId: src.id }, order: [['updatedAt', 'DESC']] }),

        // depricated
        alphaPotentialSites: (src: Organization) => src.extras && src.extras.potentialSites,
        alphaSiteSizes: (src: Organization) => src.extras && src.extras.siteSizes,
        alphaDevelopmentModels: (src: Organization) => src.extras && src.extras.developmentModels,
        alphaAvailability: (src: Organization) => src.extras && src.extras.availability,
        alphaLandUse: (src: Organization) => src.extras && src.extras.landUse,
        alphaGoodFor: (src: Organization) => src.extras && src.extras.goodFor,
        alphaSpecialAttributes: (src: Organization) => src.extras && src.extras.specialAttributes,
        alphaDummyFeaturedOpportunities: (src: Organization) => src.extras && src.extras.featuredOpportunities,
        alphaLookingFor: (src: Organization) => src.extras && src.extras.lookingFor,
        alphaGeographies: (src: Organization) => src.extras && src.extras.geographies,
        alphaDOShapeAndForm: (src: Organization) => src.extras && src.extras.doShapeAndForm,
        alphaDOCurrentUse: (src: Organization) => src.extras && src.extras.doCurrentUse,
        alphaDOGoodFitFor: (src: Organization) => src.extras && src.extras.doGoodFitFor,
        alphaDOSpecialAttributes: (src: Organization) => src.extras && src.extras.doSpecialAttributes,
        alphaDOAvailability: (src: Organization) => src.extras && src.extras.doAvailability,
        alphaARGeographies: (src: Organization) => src.extras && src.extras.arGeographies,
        alphaARAreaRange: (src: Organization) => src.extras && src.extras.arAreaRange,
        alphaARHeightLimit: (src: Organization) => src.extras && src.extras.arHeightLimit,
        alphaARActivityStatus: (src: Organization) => src.extras && src.extras.arActivityStatus,
        alphaARAquisitionBudget: (src: Organization) => src.extras && src.extras.arAquisitionBudget,
        alphaARAquisitionRate: (src: Organization) => src.extras && src.extras.arAquisitionRate,
        alphaARClosingTime: (src: Organization) => src.extras && src.extras.arClosingTime,
        alphaARSpecialAttributes: (src: Organization) => src.extras && src.extras.arSpecialAttributes,
        alphaARLandUse: (src: Organization) => src.extras && src.extras.arLandUse,
    },

    AlphaOrganizationListing: {
        // common
        id: (src: OrganizationListing) => IDs.OrganizationListing.serialize(src.id!!),
        name: (src: OrganizationListing) => src.name,
        type: (src: OrganizationListing) => src.type,
        summary: (src: OrganizationListing) => src.extras && src.extras.summary,
        specialAttributes: (src: OrganizationListing) => src.extras && src.extras.specialAttributes,
        status: (src: OrganizationListing) => src.extras && src.extras.status,
        updatedAt: (src: OrganizationListing) => (src as any).updatedAt,
        photo: (src: OrganizationListing) => src.extras && src.extras.photo,

        // DO
        location: (src: OrganizationListing) => src.extras && src.extras.location,
        locationTitle: (src: OrganizationListing) => src.extras && src.extras.locationTitle,
        availability: (src: OrganizationListing) => src.extras && src.extras.availability,
        area: (src: OrganizationListing) => src.extras && src.extras.area,
        price: (src: OrganizationListing) => src.extras && src.extras.price,
        dealType: (src: OrganizationListing) => src.extras && src.extras.dealType,
        shapeAndForm: (src: OrganizationListing) => src.extras && src.extras.shapeAndForm,
        currentUse: (src: OrganizationListing) => src.extras && src.extras.currentUse,
        goodFitFor: (src: OrganizationListing) => src.extras && src.extras.goodFitFor,
        additionalLinks: (src: OrganizationListing) => src.extras && src.extras.additionalLinks,
        // AR
        shortDescription: (src: OrganizationListing) => src.extras && src.extras.shortDescription,
        areaRange: (src: OrganizationListing) => src.extras && src.extras.areaRange,
        geographies: (src: OrganizationListing) => src.extras && src.extras.geographies,
        landUse: (src: OrganizationListing) => src.extras && src.extras.landUse,
        unitCapacity: (src: OrganizationListing) => src.extras && src.extras.unitCapacity,
    },

    AlphaOrganizationListingLink: {
        text: (src: { text: string, url: string }) => src.text,
        url: (src: { text: string, url: string }) => src.url,
    },

    OrganizationContact: {
        name: (src: ContactPerson) => src.name,
        photo: (src: ContactPerson) => src.photoRef ? buildBaseImageUrl(src.photoRef) : null,
        photoRef: (src: ContactPerson) => src.photoRef,
        position: (src: ContactPerson) => src.role,
        email: (src: ContactPerson) => src.email,
        phone: (src: ContactPerson) => src.phone,
        link: (src: ContactPerson) => src.link,
    },
    Organization: {
        id: (src: Organization) => IDs.Organization.serialize(src.id!!),
        isMine: (src: Organization, args: {}, context: CallContext) => src.id!! === context.oid!!,

        name: (src: Organization) => src.name,
        photo: (src: Organization) => src.photo ? buildBaseImageUrl(src.photo) : null,
        photoRef: (src: Organization) => src.photo,

        website: (src: Organization) => src.website,
        about: (src: Organization) => src.extras && src.extras.about,
        twitter: (src: Organization) => src.extras && src.extras.twitter,
        facebook: (src: Organization) => src.extras && src.extras.facebook,
        linkedin: (src: Organization) => src.extras && src.extras.linkedin,
        location: (src: Organization) => src.extras && src.extras.location,
        contacts: (src: Organization) => src.extras ? src.extras.contacts || [] : [],

        alphaPublished: (src: Organization) => !src.extras || src.extras.published !== false,

        alphaOrganizationType: (src: Organization) => src.extras && src.extras.organizationType,
        alphaLocations: (src: Organization) => src.extras && src.extras.locations,
        alphaInterests: (src: Organization) => src.extras && src.extras.interests,
        alphaDummyPosts: (src: Organization) => src.extras && src.extras.dummyPosts,

        alphaFollowed: async (src: Organization, args: {}, context: CallContext) => {
            if (context.oid) {
                return await isFollowed(context.oid, src.id!!);
            } else {
                return false;
            }
        },

        alphaListingDevelopmentOportunities: (src: Organization) => DB.OrganizationListing.findAll({ where: { orgId: src.id, type: 'development_opportunity' }, order: [['updatedAt', 'DESC']] }),
        alphaListingAcquisitionRequests: (src: Organization) => DB.OrganizationListing.findAll({ where: { orgId: src.id, type: 'acquisition_request' }, order: [['updatedAt', 'DESC']] }),
        alphaListingsAll: (src: Organization) => DB.OrganizationListing.findAll({ where: { orgId: src.id }, order: [['updatedAt', 'DESC']] }),

        // depricated
        alphaPotentialSites: (src: Organization) => src.extras && src.extras.potentialSites,
        alphaSiteSizes: (src: Organization) => src.extras && src.extras.siteSizes,
        alphaDevelopmentModels: (src: Organization) => src.extras && src.extras.developmentModels,
        alphaAvailability: (src: Organization) => src.extras && src.extras.availability,
        alphaLandUse: (src: Organization) => src.extras && src.extras.landUse,
        alphaGoodFor: (src: Organization) => src.extras && src.extras.goodFor,
        alphaSpecialAttributes: (src: Organization) => src.extras && src.extras.specialAttributes,

        alphaDummyFeaturedOpportunities: (src: Organization) => src.extras && src.extras.featuredOpportunities,

        alphaLookingFor: (src: Organization) => src.extras && src.extras.lookingFor,
        alphaGeographies: (src: Organization) => src.extras && src.extras.geographies,
        alphaDOShapeAndForm: (src: Organization) => src.extras && src.extras.doShapeAndForm,
        alphaDOCurrentUse: (src: Organization) => src.extras && src.extras.doCurrentUse,
        alphaDOGoodFitFor: (src: Organization) => src.extras && src.extras.doGoodFitFor,
        alphaDOSpecialAttributes: (src: Organization) => src.extras && src.extras.doSpecialAttributes,
        alphaDOAvailability: (src: Organization) => src.extras && src.extras.doAvailability,
        alphaARGeographies: (src: Organization) => src.extras && src.extras.arGeographies,
        alphaARAreaRange: (src: Organization) => src.extras && src.extras.arAreaRange,
        alphaARHeightLimit: (src: Organization) => src.extras && src.extras.arHeightLimit,
        alphaARActivityStatus: (src: Organization) => src.extras && src.extras.arActivityStatus,
        alphaARAquisitionBudget: (src: Organization) => src.extras && src.extras.arAquisitionBudget,
        alphaARAquisitionRate: (src: Organization) => src.extras && src.extras.arAquisitionRate,
        alphaARClosingTime: (src: Organization) => src.extras && src.extras.arClosingTime,
        alphaARSpecialAttributes: (src: Organization) => src.extras && src.extras.arSpecialAttributes,
        alphaARLandUse: (src: Organization) => src.extras && src.extras.arLandUse,
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
                        userId: context.uid
                    }
                });
                return await DB.Organization.findAll({
                    where: {
                        id: {
                            $in: allOrgs.map((v) => v.orgId)
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
        alphaOrganizationListings: withAny<AlphaOrganizationListingsParams>(async args => {
            let clauses: any[] = [
                { term: { orgId: IDs.Organization.parse(args.orgId) } }
            ];

            if (args.query) {
                let parser = new QueryParser();
                parser.registerText('name', 'name');
                let parsed = parser.parseQuery(args.query);
                let elasticQuery = buildElasticQuery(parsed);
                clauses.push(elasticQuery);
            }

            let hits = await ElasticClient.search({
                index: 'organization_listings',
                type: 'organization_listing',
                size: args.first,
                from: args.page ? ((args.page - 1) * args.first) : 0,
                body: {
                    query: { bool: { must: clauses } }
                }
            });

            let builder = new SelectBuilder(DB.OrganizationListing)
                .after(args.after)
                .page(args.page)
                .limit(args.first);

            return await builder.findElastic(hits);
        }),

        alphaOrganizationMembers: withAccount<{ orgId: string }>(async (args, uid, orgId) => {
            let targetOrgId = IDs.Organization.parse(args.orgId);

            let isMember = Repos.Users.isMemberOfOrganization(uid, targetOrgId);

            if (!isMember) {
                throw new AccessDeniedError(ErrorText.permissionDenied);
            }

            let members = await Repos.Organizations.getOrganizationMembers(orgId);

            let roles = await Repos.Permissions.resolveRoleInOrganization(members);

            let result: any[] = [];

            for (let i = 0; i < members.length; i++) {
                result.push({
                    _type: 'OrganizationJoinedMember',
                    user: members[i].user,
                    joinedAt: (members[i] as any).createdAt,
                    email: members[i].user.email,
                    role: roles[i]
                });
            }

            let invites = await Repos.Invites.getOneTimeInvites(orgId);

            for (let invite of invites) {
                result.push({
                    _type: 'OrganizationIvitedMember',
                    firstName: invite.memberFirstName || '',
                    lastName: invite.memberLastName || '',
                    email: invite.forEmail,
                    role: invite.memberRole,
                    inviteId: IDs.Invite.serialize(invite.id)
                });
            }

            return result;
        }),

        alphaOrganizations: withAny<AlphaOrganizationsParams>(async args => {
            let clauses: any[] = [];

            if (args.query) {
                let parser = new QueryParser();
                parser.registerText('name', 'name');
                parser.registerText('location', 'location');
                parser.registerText('organizationType', 'organizationType');
                parser.registerText('interest', 'interest');
                let parsed = parser.parseQuery(args.query);
                let elasticQuery = buildElasticQuery(parsed);
                clauses.push(elasticQuery);
            }

            clauses.push({ term: { published: true } });

            let hits = await ElasticClient.search({
                index: 'organizations',
                type: 'organization',
                size: args.first,
                from: args.page ? ((args.page - 1) * args.first) : 0,
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

        alphaOrganizationPublicInvite: withAccount(async (args, uid, orgId) => {
            return await DB.tx(async (tx) => {
                let res = await Repos.Invites.getPublicInvite(orgId, tx);
                if (!res) {
                    res = await Repos.Invites.createPublicInvite(orgId, undefined, tx);
                }
                return res;
            });

        }),
        alphaOrganizationPublicInviteForOrganizations: withAccount(async (args, uid, orgId) => {
            return await DB.tx(async (tx) => {
                let res = await Repos.Invites.getPublicInviteForOrganizations(orgId, tx);
                if (!res) {
                    res = await Repos.Invites.createPublicInviteForOrganizations(orgId, undefined, tx);
                }
                return res;

            });
        })
    },
    Mutation: {
        createOrganization: withUser<{
            input: {
                name: string,
                website?: string | null
                personal: boolean
                photoRef?: ImageRef | null
            }
        }>(async (args, uid) => {

            await validate(
                stringNotEmpty('Name can\'t be empty!'),
                args.input.name,
                'input.name'
            );

            return await DB.tx(async (tx) => {
                // Avoid multiple personal one
                if (args.input.personal) {
                    let existing = await DB.Organization.find({
                        where: {
                            userId: uid
                        },
                        transaction: tx,
                        lock: tx.LOCK.UPDATE
                    });
                    if (existing) {
                        return existing;
                    }
                }
                let status: 'ACTIVATED' | 'PENDING' = 'PENDING';
                let user = await DB.User.find({ where: { id: uid } });
                if (user && user.status === 'ACTIVATED') {
                    status = 'ACTIVATED';
                }
                let organization = await DB.Organization.create({
                    name: Sanitizer.sanitizeString(args.input.name)!,
                    website: Sanitizer.sanitizeString(args.input.website),
                    photo: Sanitizer.sanitizeImageRef(args.input.photoRef),
                    userId: args.input.personal ? uid : null,
                    status: status,
                }, { transaction: tx });
                await Repos.Super.addToOrganization(organization.id!!, uid, tx);
                await Hooks.onOrganizstionCreated(uid, organization.id!!, tx);
                return organization;
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

                alphaOrganizationType?: string[] | null
                alphaLocations?: string[] | null
                alphaInterests?: string[] | null
                alphaDummyPosts?: DummyPost[] | null

                //  depricated
                alphaPotentialSites?: Range[] | null
                alphaSiteSizes: Range[] | null
                alphaDevelopmentModels?: string[] | null
                alphaAvailability?: string[] | null
                alphaLandUse?: string[] | null
                alphaGoodFor?: string[] | null
                alphaSpecialAttributes?: string[] | null
                alphaLookingFor?: string[] | null
                alphaGeographies?: string[] | null
                alphaDOShapeAndForm?: string[] | null
                alphaDOCurrentUse?: string[] | null
                alphaDOGoodFitFor?: string[] | null
                alphaDOSpecialAttributes?: string[] | null
                alphaDOAvailability?: string[] | null
                alphaARGeographies?: string[] | null
                alphaARAreaRange?: string[] | null
                alphaARHeightLimit?: string[] | null
                alphaARActivityStatus?: string[] | null
                alphaARAquisitionBudget?: string[] | null
                alphaARAquisitionRate?: string[] | null
                alphaARClosingTime?: string[] | null
                alphaARSpecialAttributes?: string[] | null
                alphaARLandUse?: string[] | null
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
                if (args.input.photoRef !== undefined) {
                    existing.photo = Sanitizer.sanitizeImageRef(args.input.photoRef);
                }

                let extrasValidateError: { key: string, message: string }[] = [];
                let extras: OrganizationExtras = existing.extras || {};
                if (args.input.location !== undefined) {
                    extras.location = Sanitizer.sanitizeString(args.input.location);
                }
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

                if (args.input.alphaOrganizationType !== undefined) {
                    extras.organizationType = Sanitizer.sanitizeAny(args.input.alphaOrganizationType);
                }
                if (args.input.alphaLocations !== undefined) {
                    extras.locations = Sanitizer.sanitizeAny(args.input.alphaLocations);
                }
                if (args.input.alphaInterests !== undefined) {
                    extras.interests = Sanitizer.sanitizeAny(args.input.alphaInterests);
                }

                if (args.input.alphaDummyPosts !== undefined) {
                    extras.dummyPosts = args.input.alphaDummyPosts;

                    await validate(
                        {
                            alphaDummyPosts: [,
                                {
                                    text: defined(stringNotEmpty('Text can\'t be empty!')),
                                    type: defined(enumString(['update', 'news'], 'Invalid type')),
                                    date: defined(stringNotEmpty('Date can\'t be empty')),
                                    links: [,
                                        {
                                            text: defined(stringNotEmpty('Name can\'t be empty')),
                                            url: defined(stringNotEmpty('URL can\'t be empty'))
                                        }
                                    ],
                                }
                            ]
                        },
                        extras
                    );

                    if (extras.contacts) {
                        for (let contact of extras.contacts) {
                            // InputValidator.validateNonEmpty(contact.name, 'name', 'name', extrasValidateError);
                            contact.email = Sanitizer.sanitizeString(contact.email);
                            // InputValidator.validateEmail(contact.email, 'email', extrasValidateError);
                            contact.link = Sanitizer.sanitizeString(contact.link);
                            contact.role = Sanitizer.sanitizeString(contact.position);
                            contact.phone = Sanitizer.sanitizeString(contact.phone);
                        }
                    }
                }

                if (args.input.contacts !== undefined) {
                    extras.contacts = args.input.contacts;

                    await validate(
                        {
                            contacts: [,
                                {
                                    name: defined(stringNotEmpty(`Name can't be empty!`)),
                                    email: optional(emailValidator)
                                }
                            ]
                        },
                        extras
                    );

                    if (extras.contacts) {
                        for (let contact of extras.contacts) {
                            // InputValidator.validateNonEmpty(contact.name, 'name', 'name', extrasValidateError);
                            contact.email = Sanitizer.sanitizeString(contact.email);
                            // InputValidator.validateEmail(contact.email, 'email', extrasValidateError);
                            contact.link = Sanitizer.sanitizeString(contact.link);
                            contact.role = Sanitizer.sanitizeString(contact.position);
                            contact.phone = Sanitizer.sanitizeString(contact.phone);
                        }
                    }
                }

                // depricated

                if (args.input.alphaPotentialSites !== undefined) {
                    extras.potentialSites = Sanitizer.sanitizeAny(args.input.alphaPotentialSites);
                }
                if (args.input.alphaSiteSizes !== undefined) {
                    extras.siteSizes = Sanitizer.sanitizeAny(args.input.alphaSiteSizes);
                }
                if (args.input.alphaDevelopmentModels !== undefined) {
                    extras.developmentModels = Sanitizer.sanitizeAny(args.input.alphaDevelopmentModels);
                }
                if (args.input.alphaAvailability !== undefined) {
                    extras.availability = Sanitizer.sanitizeAny(args.input.alphaAvailability);
                }
                if (args.input.alphaLandUse !== undefined) {
                    extras.landUse = Sanitizer.sanitizeAny(args.input.alphaLandUse);
                }
                if (args.input.alphaGoodFor !== undefined) {
                    extras.goodFor = Sanitizer.sanitizeAny(args.input.alphaGoodFor);
                }
                if (args.input.alphaSpecialAttributes !== undefined) {
                    extras.specialAttributes = Sanitizer.sanitizeAny(args.input.alphaSpecialAttributes);
                }
                if (args.input.alphaLookingFor !== undefined) {
                    extras.lookingFor = Sanitizer.sanitizeAny(args.input.alphaLookingFor);
                }
                if (args.input.alphaGeographies !== undefined) {
                    extras.geographies = Sanitizer.sanitizeAny(args.input.alphaGeographies);
                }
                if (args.input.alphaDOShapeAndForm !== undefined) {
                    extras.doShapeAndForm = Sanitizer.sanitizeAny(args.input.alphaDOShapeAndForm);
                }
                if (args.input.alphaDOCurrentUse !== undefined) {
                    extras.doCurrentUse = Sanitizer.sanitizeAny(args.input.alphaDOCurrentUse);
                }
                if (args.input.alphaDOGoodFitFor !== undefined) {
                    extras.doGoodFitFor = Sanitizer.sanitizeAny(args.input.alphaDOGoodFitFor);
                }
                if (args.input.alphaDOSpecialAttributes !== undefined) {
                    extras.doSpecialAttributes = Sanitizer.sanitizeAny(args.input.alphaDOSpecialAttributes);
                }
                if (args.input.alphaDOAvailability !== undefined) {
                    extras.doAvailability = Sanitizer.sanitizeAny(args.input.alphaDOAvailability);
                }
                if (args.input.alphaARGeographies !== undefined) {
                    extras.arGeographies = Sanitizer.sanitizeAny(args.input.alphaARGeographies);
                }
                if (args.input.alphaARAreaRange !== undefined) {
                    extras.arAreaRange = Sanitizer.sanitizeAny(args.input.alphaARAreaRange);
                }
                if (args.input.alphaARHeightLimit !== undefined) {
                    extras.arHeightLimit = Sanitizer.sanitizeAny(args.input.alphaARHeightLimit);
                }
                if (args.input.alphaARActivityStatus !== undefined) {
                    extras.arActivityStatus = Sanitizer.sanitizeAny(args.input.alphaARActivityStatus);
                }
                if (args.input.alphaARAquisitionBudget !== undefined) {
                    extras.arAquisitionBudget = Sanitizer.sanitizeAny(args.input.alphaARAquisitionBudget);
                }
                if (args.input.alphaARAquisitionRate !== undefined) {
                    extras.arAquisitionRate = Sanitizer.sanitizeAny(args.input.alphaARAquisitionRate);
                }
                if (args.input.alphaARClosingTime !== undefined) {
                    extras.arClosingTime = Sanitizer.sanitizeAny(args.input.alphaARClosingTime);
                }
                if (args.input.alphaARSpecialAttributes !== undefined) {
                    extras.arSpecialAttributes = Sanitizer.sanitizeAny(args.input.alphaARSpecialAttributes);
                }
                if (args.input.alphaARLandUse !== undefined) {
                    extras.arLandUse = Sanitizer.sanitizeAny(args.input.alphaARLandUse);
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
            let orgId = IDs.Organization.parse(args.id);
            if (orgId === oid) {
                throw new UserError('Unable to follow your own organization');
            }
            return await DB.tx(async (tx) => {
                let existing = await DB.OrganizationConnect.find({
                    where: {
                        initiatorOrgId: oid,
                        targetOrgId: orgId
                    },
                    transaction: tx,
                    lock: tx.LOCK.UPDATE
                });
                let newStatus: 'FOLLOWING' | 'NOT_FOLLOWING' = args.follow ? 'FOLLOWING' : 'NOT_FOLLOWING';
                if (existing) {
                    existing.followStatus = newStatus;
                    await existing.save({ transaction: tx });
                } else {
                    await DB.OrganizationConnect.create({
                        initiatorOrgId: oid,
                        targetOrgId: orgId,
                        followStatus: newStatus,
                    }, { transaction: tx });
                }
                return await DB.Organization.findById(orgId, { transaction: tx });
            });
        }),
        alphaOrganizationCreateListing: withAccount<{

            type: 'development_opportunity' | 'acquisition_request';

            input: {
                // common
                name: string;
                summary?: string | null;
                specialAttributes?: string[] | null;
                status?: 'open' | null;
                photo?: ImageRef | null

                // DO
                location?: { lon: number, lat: number, ref?: string, count?: number };
                locationTitle?: string;
                availability?: string | null;
                area?: number | null;
                price?: number | null;
                dealType?: string[] | null;
                shapeAndForm?: string[] | null;
                currentUse?: string[] | null;
                goodFitFor?: string[] | null;
                additionalLinks?: { text: string, url: string }[] | null;

                // AR
                shortDescription?: string | null;
                areaRange?: Range | null;
                geographies?: string[] | null;
                landUse?: string[] | null;
                unitCapacity?: string[] | null;
            }
        }>(async (args, uid, oid) => {
            return await DB.tx(async (tx) => {
                let member = await DB.OrganizationMember.find({
                    where: {
                        orgId: oid,
                        userId: uid,
                    },
                    transaction: tx
                });
                if (member === null || !member.isOwner) {
                    throw new UserError(ErrorText.permissionOnlyOwner);
                }

                await validate(
                    {
                        type: defined(enumString(['development_opportunity', 'acquisition_request'])),
                        input: {
                            name: defined(stringNotEmpty(`Name can't be empty!`)),
                            status: optional(enumString(['open'])),
                            additionalLinks: [
                                ,
                                {
                                    text: stringNotEmpty(`Text can't be empty!`),
                                    url: stringNotEmpty(`Url can't be empty!`)
                                }
                            ]
                        }
                    },
                    args
                );

                // common
                let extras = {} as ListingExtras;
                if (args.input.summary !== undefined) {
                    extras.summary = Sanitizer.sanitizeString(args.input.summary);
                }

                if (args.input.specialAttributes !== undefined) {
                    extras.specialAttributes = Sanitizer.sanitizeAny(args.input.specialAttributes);
                }

                if (args.input.photo !== undefined) {
                    extras.photo = Sanitizer.sanitizeImageRef(args.input.photo);
                }

                // DO
                if (args.input.location !== undefined) {
                    extras.location = Sanitizer.sanitizeAny(args.input.location)!;
                }

                // extras.locationTitle = Sanitizer.sanitizeString(args.input.locationTitle)!;
                // if (args.type === 'development_opportunity' && !extras.locationTitle) {
                //     extrasValidateError.push({ key: 'input.locationTitle', message: 'Full address can\'t be empty' });
                // }
                if (args.input.locationTitle !== undefined) {
                    extras.locationTitle = Sanitizer.sanitizeAny(args.input.locationTitle)!;
                }

                if (args.input.availability !== undefined) {
                    extras.availability = Sanitizer.sanitizeString(args.input.availability);
                }

                if (args.input.area !== undefined) {
                    extras.area = Sanitizer.sanitizeNumber(args.input.area);
                }

                if (args.input.price !== undefined) {
                    extras.price = Sanitizer.sanitizeNumber(args.input.price);
                }

                if (args.input.dealType !== undefined) {
                    extras.dealType = Sanitizer.sanitizeAny(args.input.dealType);
                }

                if (args.input.shapeAndForm !== undefined) {
                    extras.shapeAndForm = Sanitizer.sanitizeAny(args.input.shapeAndForm);
                }

                if (args.input.currentUse !== undefined) {
                    extras.currentUse = Sanitizer.sanitizeAny(args.input.currentUse);
                }

                if (args.input.goodFitFor !== undefined) {
                    extras.goodFitFor = Sanitizer.sanitizeAny(args.input.goodFitFor);
                }

                // AR 
                if (args.input.shortDescription !== undefined) {
                    extras.shortDescription = Sanitizer.sanitizeString(args.input.shortDescription);
                }

                if (args.input.areaRange !== undefined) {
                    extras.areaRange = Sanitizer.sanitizeAny(args.input.areaRange);
                }

                if (args.input.landUse !== undefined) {
                    extras.landUse = Sanitizer.sanitizeAny(args.input.landUse);
                }

                if (args.input.geographies !== undefined) {
                    extras.geographies = Sanitizer.sanitizeAny(args.input.geographies);
                }

                if (args.input.unitCapacity !== undefined) {
                    extras.unitCapacity = Sanitizer.sanitizeAny(args.input.unitCapacity);
                }

                return await DB.OrganizationListing.create({
                    name: args.input.name,
                    type: args.type,
                    extras: extras,
                    userId: uid,
                    orgId: oid,
                }, { transaction: tx });

            });

        }),
        alphaOrganizationEditListing: withAccount<{
            id: string;

            input: {
                // common
                name?: string;
                summary?: string | null;
                specialAttributes?: string[] | null;
                status?: 'open' | null;
                photo?: ImageRef | null

                // DO
                location?: { lon: number, lat: number, ref?: string, count?: number };
                locationTitle?: string;
                availability?: string | null;
                area?: number | null;
                price?: number | null;
                dealType?: string[] | null;
                shapeAndForm?: string[] | null;
                currentUse?: string[] | null;
                goodFitFor?: string[] | null;
                additionalLinks?: { text: string, url: string }[] | null;

                // AR
                shortDescription?: string | null;
                areaRange?: Range | null;
                geographies?: string[] | null;
                landUse?: string[] | null;
                unitCapacity?: string[] | null;
            }
        }>(async (args, uid, oid) => {
            return await DB.tx(async (tx) => {
                let member = await DB.OrganizationMember.find({
                    where: {
                        orgId: oid,
                        userId: uid,
                    },
                    transaction: tx,
                });
                if (member === null || !member.isOwner) {
                    throw new UserError(ErrorText.permissionOnlyOwner);
                }

                let existing = await DB.OrganizationListing.find({ where: { id: IDs.OrganizationListing.parse(args.id), orgId: oid }, transaction: tx, lock: tx.LOCK.UPDATE });
                if (!existing) {
                    throw new UserError(ErrorText.unableToFindListing);
                }

                let extrasValidateError: { key: string, message: string }[] = [];

                await validate(
                    {
                        input: {
                            name: defined(stringNotEmpty(`Name cant't be empty`)),
                            status: optional(enumString(['open'])),
                            additionalLinks: [
                                ,
                                {
                                    text: stringNotEmpty(`Text can't be empty!`),
                                    url: stringNotEmpty(`Url can't be empty!`)
                                }
                            ]
                        }
                    },
                    args
                );

                // basic
                if (args.input.name !== undefined) {
                    existing.name = args.input.name;
                }

                // common
                let extras = existing.extras!;
                if (args.input.summary !== undefined) {
                    extras.summary = Sanitizer.sanitizeString(args.input.summary);
                }

                if (args.input.specialAttributes !== undefined) {
                    extras.specialAttributes = Sanitizer.sanitizeAny(args.input.specialAttributes);
                }

                if (args.input.status !== undefined) {
                    extras.status = Sanitizer.sanitizeString(args.input.status) as ('open' | null);
                }

                if (args.input.photo !== undefined) {
                    extras.photo = Sanitizer.sanitizeImageRef(args.input.photo);
                }

                // DO
                if (args.input.location !== undefined) {
                    extras.location = Sanitizer.sanitizeAny(args.input.location)!;
                }

                // if (args.input.locationTitle !== undefined) {
                //     extras.locationTitle = Sanitizer.sanitizeString(args.input.locationTitle)!;
                //     if (existing.type === 'development_opportunity' && !extras.locationTitle) {
                //         extras.locationTitle = Sanitizer.sanitizeString(args.input.locationTitle);
                //         extrasValidateError.push({ key: 'input.locationTitle', message: 'Full address can\'t be empty' });
                //     }
                // }
                if (args.input.locationTitle !== undefined) {
                    extras.locationTitle = Sanitizer.sanitizeAny(args.input.locationTitle)!;
                }

                if (args.input.availability !== undefined) {
                    extras.availability = Sanitizer.sanitizeString(args.input.availability);
                }

                if (args.input.area !== undefined) {
                    extras.area = Sanitizer.sanitizeNumber(args.input.area);
                }

                if (args.input.price !== undefined) {
                    extras.price = Sanitizer.sanitizeNumber(args.input.price);
                }

                if (args.input.dealType !== undefined) {
                    extras.dealType = Sanitizer.sanitizeAny(args.input.dealType);
                }

                if (args.input.shapeAndForm !== undefined) {
                    extras.shapeAndForm = Sanitizer.sanitizeAny(args.input.shapeAndForm);
                }

                if (args.input.currentUse !== undefined) {
                    extras.currentUse = Sanitizer.sanitizeAny(args.input.currentUse);
                }

                if (args.input.goodFitFor !== undefined) {
                    extras.goodFitFor = Sanitizer.sanitizeAny(args.input.goodFitFor);
                }

                if (args.input.additionalLinks !== undefined) {
                    extras.additionalLinks = Sanitizer.sanitizeAny(args.input.additionalLinks);
                }

                // AR 
                if (args.input.shortDescription !== undefined) {
                    extras.shortDescription = Sanitizer.sanitizeString(args.input.shortDescription);
                }

                if (args.input.areaRange !== undefined) {
                    extras.areaRange = Sanitizer.sanitizeAny(args.input.areaRange);
                }

                if (args.input.landUse !== undefined) {
                    extras.landUse = Sanitizer.sanitizeAny(args.input.landUse);
                }

                if (args.input.geographies !== undefined) {
                    extras.geographies = Sanitizer.sanitizeAny(args.input.geographies);
                }

                if (args.input.unitCapacity !== undefined) {
                    extras.unitCapacity = Sanitizer.sanitizeAny(args.input.unitCapacity);
                }

                existing.extras = extras;

                if (extrasValidateError.length > 0) {
                    throw new InvalidInputError(extrasValidateError);
                }

                await existing.save({ transaction: tx });
                return existing;
            });

        }),
        alphaOrganizationDeleteListing: withAccount<{ id: string }>(async (args, uid, oid) => {
            return await DB.tx(async (tx) => {
                let member = await DB.OrganizationMember.find({
                    where: {
                        orgId: oid,
                        userId: uid,
                    },
                    transaction: tx,
                });
                if (member === null || !member.isOwner) {
                    throw new UserError(ErrorText.permissionOnlyOwner);
                }

                let listing = await DB.OrganizationListing.find({
                    where: { orgId: oid, id: IDs.OrganizationListing.parse(args.id) },
                    lock: tx.LOCK.UPDATE,
                    transaction: tx
                });

                if (!listing) {
                    throw new NotFoundError(ErrorText.unableToFindListing);
                }
                await listing.destroy({ transaction: tx });
                return 'ok';
            });
        }),
        alphaOrganizationRemoveMember: withAccount<{ memberId: string }>(async (args, uid, oid) => {
            return await DB.tx(async (tx) => {
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
                    await Emails.sendMemberRemovedEmail(oid, memberId, tx);

                } else if (idType.type.typeName === 'Invite') {
                    let inviteId = IDs.Invite.parse(args.memberId);

                    let invite = await DB.OrganizationInvite.findOne({
                        where: {
                            id: inviteId
                        },
                        transaction: tx
                    });

                    if (!invite) {
                        return 'ok';
                    }

                    let invitedByUser = (invite.creatorId && (invite.creatorId === uid)) || false;

                    if (!isOwner && !invitedByUser) {
                        throw new AccessDeniedError(ErrorText.permissionDenied);
                    }

                    await invite.destroy({ transaction: tx });
                }

                return 'ok';
            });
        }),
        alphaOrganizationChangeMemberRole: withAccount<{ memberId: string, newRole: 'OWNER' | 'MEMBER' }>(async (args, uid, oid) => {
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
                } else if (idType.type.typeName === 'Invite') {
                    let invite = await DB.OrganizationInvite.findOne({
                        where: {
                            id: IDs.Invite.parse(args.memberId)
                        }
                    });

                    if (!invite) {
                        throw new NotFoundError();
                    }

                    await invite.update({
                        memberRole: args.newRole
                    }, { transaction: tx });
                }

                return 'ok';
            });
        }),
        alphaOrganizationInviteMembers: withAccount<{ inviteRequests: { email: string, emailText?: string, firstName?: string, lastName?: string, role: 'OWNER' | 'MEMBER' }[] }>(async (args, uid, oid) => {
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

            return await DB.tx(async (tx) => {
                for (let inviteRequest of args.inviteRequests) {
                    let isDuplicate = await Repos.Invites.haveInviteForEmail(oid, inviteRequest.email, tx);

                    if (isDuplicate) {
                        throw new UserError(ErrorText.inviteAlreadyExists);
                    }

                    let isMemberDuplicate = await Repos.Organizations.haveMemberWithEmail(oid, inviteRequest.email);

                    if (isMemberDuplicate) {
                        throw new UserError(ErrorText.memberWithEmailAlreadyExists);
                    }

                    let invite = await Repos.Invites.createOneTimeInvite(
                        oid,
                        uid,
                        inviteRequest.firstName || '',
                        inviteRequest.lastName || '',
                        inviteRequest.email,
                        inviteRequest.emailText || '',
                        inviteRequest.role,
                        tx
                    );

                    await Emails.sendInviteEmail(oid, invite, tx);
                }
                return 'ok';
            });
        }),
        alphaOrganizationCreatePublicInvite: withAccount<{ expirationDays?: number }>(async (args, uid, oid) => {
            return DB.tx(async (tx) => {

                let isOwner = await Repos.Organizations.isOwnerOfOrganization(oid, uid, tx);

                if (!isOwner) {
                    throw new UserError(ErrorText.permissionOnlyOwner);
                }

                return await Repos.Invites.createPublicInvite(oid, args.expirationDays, tx);
            });
        }),
        alphaOrganizationDeletePublicInvite: withAccount(async (args, uid, oid) => {
            return DB.tx(async (tx) => {
                let isOwner = await Repos.Organizations.isOwnerOfOrganization(oid, uid, tx);

                if (!isOwner) {
                    throw new UserError(ErrorText.permissionOnlyOwner);
                }

                await Repos.Invites.deletePublicInvite(oid, tx);

                return 'ok';
            });
        }),
        alphaOrganizationInviteOrganization: withAccount<{ inviteRequests: { email: string, emailText?: string, firstName?: string, lastName?: string }[] }>(async (args, uid, oid) => {
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

            return DB.tx(async (tx) => {
                for (let inviteRequest of args.inviteRequests) {

                    let isDuplicate = await Repos.Invites.haveOrganizationInviteForEmail(oid, inviteRequest.email, tx);

                    if (isDuplicate) {
                        throw new UserError(ErrorText.inviteAlreadyExists);
                    }

                    let invite = await Repos.Invites.createOneTimeInviteForOrg(
                        oid,
                        uid,
                        inviteRequest.firstName || '',
                        inviteRequest.lastName || '',
                        inviteRequest.email,
                        inviteRequest.emailText || '',
                        tx
                    );

                    await Emails.sendOrganizationInviteEmail(oid, invite, tx);
                }
                return 'ok';
            });
        }),
        alphaOrganizationActivateByInvite: withAccount<{ key: string }>(async (args, uid, oid) => {
            return await DB.tx(async (tx) => {
                let invite = await DB.OrganizationInvite.find({
                    where: {
                        uuid: args.key,
                        type: 'for_organization'
                    },
                    transaction: tx
                });

                if (!invite) {
                    throw new NotFoundError(ErrorText.unableToFindInvite);
                }

                let org = await DB.Organization.findById(oid, { transaction: tx });

                if (!org) {
                    return 'ok';
                }

                await org.update({ status: 'ACTIVATED' }, { transaction: tx });

                if (invite.isOneTime === true) {
                    await invite.destroy({ transaction: tx });
                }

                return 'ok';
            });
        }),
        alphaOrganizationCreatePublicInviteForOrganizations: withAccount<{ expirationDays?: number }>(async (args, uid, oid) => {

            return await DB.tx(async (tx) => {
                let isOwner = await Repos.Organizations.isOwnerOfOrganization(oid, uid, tx);

                if (!isOwner) {
                    throw new UserError(ErrorText.permissionOnlyOwner);
                }

                return await Repos.Invites.createPublicInviteForOrganizations(oid, args.expirationDays, tx);
            });
        }),
        alphaOrganizationDeletePublicInviteForOrganizations: withAccount<{ expirationDays: number }>(async (args, uid, oid) => {
            return DB.tx(async (tx) => {
                let isOwner = await Repos.Organizations.isOwnerOfOrganization(oid, uid, tx);

                if (!isOwner) {
                    throw new UserError(ErrorText.permissionOnlyOwner);
                }

                await Repos.Invites.deletePublicInviteForOrganizations(oid, tx);

                return 'ok';
            });
        })
    }
};