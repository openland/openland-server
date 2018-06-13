import { DB } from '../tables';
import { Organization } from '../tables/Organization';
import { IDs } from './utils/IDs';
import { buildBaseImageUrl } from '../repositories/Media';
import { withUser, withAccount, withAny } from './utils/Resolvers';
import { Repos } from '../repositories';
import { ImageRef } from '../repositories/Media';
import { CallContext } from './utils/CallContext';
import { OrganizationExtras, ContactPerson } from '../repositories/OrganizationExtras';
import { UserError } from '../errors/UserError';
import { ErrorText } from '../errors/ErrorText';
import { NotFoundError } from '../errors/NotFoundError';
import { Sanitizer } from '../modules/Sanitizer';
import { InvalidInputError } from '../errors/InvalidInputError';

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
        contacts: (src: Organization) => src.extras ? src.extras.contacts : undefined,

        alphaPotentialSites: (src: Organization) => src.extras && src.extras.potentialSites,
        alphaSiteSizes: (src: Organization) => src.extras && src.extras.siteSizes,
        alphaDevelopmentModels: (src: Organization) => src.extras && src.extras.developmentModels,
        alphaAvailability: (src: Organization) => src.extras && src.extras.availability,
        alphaLandUse: (src: Organization) => src.extras && src.extras.landUse,
        alphaGoodFor: (src: Organization) => src.extras && src.extras.goodFor,
        alphaSpecialAttributes: (src: Organization) => src.extras && src.extras.specialAttributes,
    },

    OrganizationContact: {
        name: (src: ContactPerson) => src.name,
        photo: (src: ContactPerson) => src.avatarRef ? buildBaseImageUrl(src.avatarRef) : null,
        photoRef: (src: ContactPerson) => src.avatarRef,
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
        contacts: (src: Organization) => src.extras ? src.extras.contacts : undefined,

        alphaPotentialSites: (src: Organization) => src.extras && src.extras.potentialSites,
        alphaSiteSizes: (src: Organization) => src.extras && src.extras.siteSizes,
        alphaDevelopmentModels: (src: Organization) => src.extras && src.extras.developmentModels,
        alphaAvailability: (src: Organization) => src.extras && src.extras.availability,
        alphaLandUse: (src: Organization) => src.extras && src.extras.landUse,
        alphaGoodFor: (src: Organization) => src.extras && src.extras.goodFor,
        alphaSpecialAttributes: (src: Organization) => src.extras && src.extras.specialAttributes,

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
                await DB.Organization.findById(context.oid);
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
        alphaCreateOrganization: withUser<{ title: string, website?: string, logo?: ImageRef, personal?: boolean }>(async (args, uid) => {
            if (!args.title || !args.title.trim()) {
                throw new UserError(ErrorText.titleRequired);
            }
            return await DB.tx(async (tx) => {
                let organization = await DB.Organization.create({
                    name: args.title.trim(),
                    website: args.website ? args.website.trim() : null,
                    photo: args.logo,
                    userId: args.personal ? uid : undefined
                }, { transaction: tx });
                await Repos.Super.addToOrganization(organization.id!!, uid, tx);
                return IDs.OrganizationAccount.serialize(organization.id!!);
            });
        }),

        alphaEditOrganizationProfile: withAccount<{ title?: string, website?: string, logo?: ImageRef, extras?: OrganizationExtras }>(async (args, uid, oid) => {

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
                let existing = await DB.Organization.find({ where: { id: oid }, transaction: tx });
                if (!existing) {
                    throw new UserError(ErrorText.unableToFindOrganization);

                } else {
                    if (args.title !== undefined) {
                        if (args.title === null || args.title.trim() === '') {
                            throw new UserError(ErrorText.titleRequired);
                        }
                        existing.name = args.title;
                    }
                    if (args.website !== undefined) {
                        existing.website = args.website === null ? null : args.website.trim();
                    }
                    if (args.logo !== undefined) {
                        existing.photo = args.logo;
                    }
                    if (args.extras !== undefined) {
                        let editedExtras: any = existing.extras || {};
                        for (let key of Object.keys(args.extras)) {
                            if (key === 'contacts') {
                                if (args.extras.contacts !== undefined) {
                                    editedExtras.contacts = args.extras.contacts ? args.extras.contacts.map(((contact) => {
                                        return { ...contact, avatar: contact.avatarRef ? buildBaseImageUrl(contact.avatarRef) : undefined, avatarRef: contact.avatarRef };
                                    })) : undefined;
                                }
                            } else if ((args.extras as any)[key] !== undefined) {
                                editedExtras[key] = (args.extras as any)[key] || undefined;
                            }
                        }
                        existing.extras = editedExtras;
                    }

                    await existing.save({ transaction: tx });
                    return 'ok';
                }
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