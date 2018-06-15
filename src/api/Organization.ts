import { DB } from '../tables';
import { Organization } from '../tables/Organization';
import { IDs } from './utils/IDs';
import { buildBaseImageUrl } from '../repositories/Media';
import { withUser, withAccount, withAny } from './utils/Resolvers';
import { Repos } from '../repositories';
import { ImageRef } from '../repositories/Media';
import { CallContext } from './utils/CallContext';
import { OrganizationExtras, ContactPerson, Range, DevelopmentModels, Availability, LandUse, GoodFor, SpecialAttributes, DevelopmentModelsValues, AvailabilityValues, LandUseValues, GoodForValues, SpecialAttributesValues, FeaturedOpportunity } from '../repositories/OrganizationExtras';
import { UserError } from '../errors/UserError';
import { ErrorText } from '../errors/ErrorText';
import { NotFoundError } from '../errors/NotFoundError';
import { Sanitizer } from '../modules/Sanitizer';
import { InvalidInputError } from '../errors/InvalidInputError';
import { InputValidator } from '../modules/InputValidator';

let isFollowed = async (initiatorOrgId: number, targetOrgId: number) => {
    let connection = await DB.OrganizationConnect.find({
        where: {
            initiatorOrgId: initiatorOrgId,
            targetOrgId: targetOrgId
        }
    });

    return !!(connection && connection.followStatus === 'FOLLOWING');
};

export const Resolver = {
    OrganizationProfile: {
        id: (src: Organization) => IDs.Organization.serialize(src.id!!),
        name: (src: Organization) => src.name,
        photoRef: (src: Organization) => src.photo,

        website: (src: Organization) => src.website,
        about: (src: Organization) => src.extras && src.extras.about,
        twitter: (src: Organization) => src.extras && src.extras.twitter,
        facebook: (src: Organization) => src.extras && src.extras.facebook,
        location: (src: Organization) => src.extras && src.extras.location,
        contacts: (src: Organization) => src.extras ? src.extras.contacts || [] : [],

        alphaPotentialSites: (src: Organization) => src.extras && src.extras.potentialSites,
        alphaSiteSizes: (src: Organization) => src.extras && src.extras.siteSizes,
        alphaDevelopmentModels: (src: Organization) => src.extras && src.extras.developmentModels,
        alphaAvailability: (src: Organization) => src.extras && src.extras.availability,
        alphaLandUse: (src: Organization) => src.extras && src.extras.landUse,
        alphaGoodFor: (src: Organization) => src.extras && src.extras.goodFor,
        alphaSpecialAttributes: (src: Organization) => src.extras && src.extras.specialAttributes,
        alphaDummyFeaturedOpportunities: (src: Organization) => src.extras && src.extras.featuredOpportunities,
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
        location: (src: Organization) => src.extras && src.extras.location,
        contacts: (src: Organization) => src.extras ? src.extras.contacts || [] : [],

        alphaPotentialSites: (src: Organization) => src.extras && src.extras.potentialSites,
        alphaSiteSizes: (src: Organization) => src.extras && src.extras.siteSizes,
        alphaDevelopmentModels: (src: Organization) => src.extras && src.extras.developmentModels,
        alphaAvailability: (src: Organization) => src.extras && src.extras.availability,
        alphaLandUse: (src: Organization) => src.extras && src.extras.landUse,
        alphaGoodFor: (src: Organization) => src.extras && src.extras.goodFor,
        alphaSpecialAttributes: (src: Organization) => src.extras && src.extras.specialAttributes,
        alphaDummyFeaturedOpportunities: (src: Organization) => src.extras && src.extras.featuredOpportunities,
        alphaFollowed: async (src: Organization, args: {}, context: CallContext) => {
            if (context.oid) {
                return await isFollowed(context.oid, src.id!!);
            } else {
                return false;
            }
        },
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
            let name = Sanitizer.sanitizeString(args.input.name);
            if (!name) {
                throw new InvalidInputError([{ key: 'input.name', message: 'Name can\'t be empty!' }]);
            }
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
                let organization = await DB.Organization.create({
                    name: name!!,
                    website: Sanitizer.sanitizeString(args.input.website),
                    photo: Sanitizer.sanitizeImageRef(args.input.photoRef),
                    userId: args.input.personal ? uid : null
                }, { transaction: tx });
                await Repos.Super.addToOrganization(organization.id!!, uid, tx);
                return organization;
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
                location?: string | null

                contacts?: {
                    name: string
                    photoRef?: ImageRef | null
                    position?: string | null
                    email?: string | null
                    phone?: string | null
                    link?: string | null
                }[] | null

                alphaPotentialSites?: Range[] | null
                alphaSiteSizes: Range[] | null
                alphaDevelopmentModels?: DevelopmentModels[] | null
                alphaAvailability?: Availability[] | null
                alphaLandUse?: LandUse[] | null
                alphaGoodFor?: GoodFor[] | null
                alphaSpecialAttributes?: SpecialAttributes[] | null
                alphaDummyFeaturedOpportunities?: FeaturedOpportunity[] | null
            }
        }>(async (args, uid, oid) => {
            let member = await DB.OrganizationMember.find({
                where: {
                    orgId: oid,
                    userId: uid,
                }
            });
            if (member === null || !member.isOwner) {
                throw new UserError(ErrorText.permissionOnlyOwner);
            }
            return await DB.tx(async (tx) => {
                let existing = await DB.Organization.find({ where: { id: oid }, transaction: tx, lock: tx.LOCK.UPDATE });
                if (!existing) {
                    throw new UserError(ErrorText.unableToFindOrganization);
                }

                if (args.input.name !== undefined) {
                    let name = Sanitizer.sanitizeString(args.input.name);
                    if (!name) {
                        throw new InvalidInputError([{ key: 'input.name', message: 'Name can\'t be empty!' }]);
                    }
                    existing.name = name;
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
                if (args.input.about !== undefined) {
                    extras.about = Sanitizer.sanitizeString(args.input.about);
                }
                if (args.input.alphaPotentialSites !== undefined) {
                    extras.potentialSites = Sanitizer.sanitizeAny(args.input.alphaPotentialSites);
                }
                if (args.input.alphaSiteSizes !== undefined) {
                    extras.siteSizes = Sanitizer.sanitizeAny(args.input.alphaSiteSizes);
                }
                if (args.input.alphaDevelopmentModels !== undefined) {
                    InputValidator.validateEnumStrings(args.input.alphaDevelopmentModels, DevelopmentModelsValues, 'Development Models', 'input.alphaDevelopmentModels', extrasValidateError);
                    extras.developmentModels = Sanitizer.sanitizeAny(args.input.alphaDevelopmentModels);
                }
                if (args.input.alphaAvailability !== undefined) {
                    InputValidator.validateEnumStrings(args.input.alphaAvailability, AvailabilityValues, 'Availability', 'input.alphaAvailability', extrasValidateError);
                    extras.availability = Sanitizer.sanitizeAny(args.input.alphaAvailability);
                }
                if (args.input.alphaLandUse !== undefined) {
                    InputValidator.validateEnumStrings(args.input.alphaLandUse, LandUseValues, 'Land Use', 'input.alphaLandUse', extrasValidateError);
                    extras.landUse = Sanitizer.sanitizeAny(args.input.alphaLandUse);
                }
                if (args.input.alphaGoodFor !== undefined) {
                    InputValidator.validateEnumStrings(args.input.alphaGoodFor, GoodForValues, 'Good For', 'input.alphaGoodFor', extrasValidateError);
                    extras.goodFor = Sanitizer.sanitizeAny(args.input.alphaGoodFor);
                }
                if (args.input.alphaSpecialAttributes !== undefined) {
                    InputValidator.validateEnumStrings(args.input.alphaSpecialAttributes, SpecialAttributesValues, 'Special Attributes', 'input.alphaSpecialAttributes', extrasValidateError);
                    extras.specialAttributes = Sanitizer.sanitizeAny(args.input.alphaSpecialAttributes);
                }
                if (args.input.contacts !== undefined) {
                    extras.contacts = args.input.contacts;
                    if (extras.contacts) {
                        for (let contact of extras.contacts) {
                            InputValidator.validateNonEmpty(contact.name, 'name', 'name', extrasValidateError);
                            contact.email = Sanitizer.sanitizeString(contact.email);
                            InputValidator.validateEmail(contact.email, 'email', extrasValidateError);
                            contact.link = Sanitizer.sanitizeString(contact.link);
                            contact.role = Sanitizer.sanitizeString(contact.role);
                            contact.phone = Sanitizer.sanitizeString(contact.phone);
                        }
                    }
                }
                if (args.input.alphaDummyFeaturedOpportunities !== undefined) {
                    extras.featuredOpportunities = args.input.alphaDummyFeaturedOpportunities;
                    if (extras.featuredOpportunities) {
                        for (let featuredOpportunity of extras.featuredOpportunities) {
                            InputValidator.validateNonEmpty(featuredOpportunity.title, 'title', 'title', extrasValidateError);
                            InputValidator.validateNonEmpty(featuredOpportunity.locationTitle, 'Location Title', 'locationTitle', extrasValidateError);
                            featuredOpportunity.tags = Sanitizer.sanitizeAny(featuredOpportunity.tags);
                            InputValidator.validateEnumStrings(featuredOpportunity.tags, [...LandUseValues, ...GoodForValues, ...SpecialAttributesValues], 'Tags', 'tags', extrasValidateError);
                        }
                    }
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
    }
};