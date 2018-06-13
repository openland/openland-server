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

let amIOwner = async (oid: number, uid: number) => {
    let member = await DB.OrganizationMember.find({
        where: {
            orgId: oid,
            userId: uid,
        }
    });
    return !!(member && member.isOwner);
};

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
    AlphaOrganizationProfile: {
        id: (src: Organization) => IDs.OrganizationAccount.serialize(src.id!!),
        iAmOwner: (src: Organization, args: {}, context: CallContext) => amIOwner(src.id!!, context.uid!!),
        personalOrganizationUser: (src: Organization) => src.userId !== null && src.userId !== undefined ? DB.User.findById(src.userId) : undefined,
        isCurrent: (src: Organization, args: {}, context: CallContext) => src.id!! === context.oid!!,
        followed: (src: Organization, args: {}, context: CallContext) => isFollowed(context.oid!!, src.id!!),
        title: (src: Organization) => src.name,
        name: (src: Organization) => src.name,
        logo: (src: Organization) => src.photo ? buildBaseImageUrl(src.photo) : null,
        photo: (src: Organization) => src.photo ? buildBaseImageUrl(src.photo) : null,
        photoRef: (src: Organization) => src.photo,
        website: (src: Organization) => src.website,
        potentialSites: (src: Organization) => src.extras ? src.extras.potentialSites : undefined,
        siteSizes: (src: Organization) => src.extras ? src.extras.siteSizes : undefined,
        about: (src: Organization) => src.extras ? src.extras.about : undefined,
        description: (src: Organization) => src.extras ? src.extras.about : undefined,
        twitter: (src: Organization) => src.extras ? src.extras.twitter : undefined,
        facebook: (src: Organization) => src.extras ? src.extras.facebook : undefined,
        developmentModels: (src: Organization) => src.extras ? src.extras.developmentModels : undefined,
        availability: (src: Organization) => src.extras ? src.extras.availability : undefined,
        contacts: (src: Organization) => src.extras ? src.extras.contacts : undefined,
        landUse: (src: Organization) => src.extras ? src.extras.landUse : undefined,
        goodFor: (src: Organization) => src.extras ? src.extras.goodFor : undefined,
        specialAttributes: (src: Organization) => src.extras ? src.extras.specialAttributes : undefined,
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
        organization: withAny<{ id: string }>(async (args) => {
            let res = await DB.Organization.findById(IDs.Organization.parse(args.id));
            if (!res) {
                throw new NotFoundError('Unable to find organization');
            }
            return res;
        }),

        alphaCurrentOrganizationProfile: withAccount(async (args, uid, oid) => {
            return await DB.Organization.findById(oid);
        }),

        alphaOrganizationProfile: withAccount<{ id: string }>(async (args, uid, oid) => {
            return await DB.Organization.findById(IDs.OrganizationAccount.parse(args.id));
        }),
    },
    Mutation: {
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
                let res;
                if (existing) {
                    existing.followStatus = newStatus;
                    res = existing;
                    await existing.save({ transaction: tx });
                } else {
                    res = await DB.OrganizationConnect.create({
                        initiatorOrgId: oid,
                        targetOrgId: orgId,
                        followStatus: newStatus,
                    }, { transaction: tx });
                }

                return await DB.Organization.findById(orgId, { transaction: tx });
            });
        }),

        alphaAlterOrganizationFollow: withAccount<{ orgId: string, follow: boolean }>(async (args, uid, oid) => {
            let targetId = IDs.OrganizationAccount.parse(args.orgId);
            return await DB.tx(async (tx) => {
                let existing = await DB.OrganizationConnect.find({
                    where: {
                        initiatorOrgId: oid,
                        targetOrgId: targetId
                    },
                    transaction: tx
                });
                let newStatus: 'FOLLOWING' | 'NOT_FOLLOWING' = args.follow ? 'FOLLOWING' : 'NOT_FOLLOWING';
                let res;
                if (existing) {
                    existing.followStatus = newStatus;
                    res = existing;
                    await existing.save({ transaction: tx });
                } else {
                    res = await DB.OrganizationConnect.create({
                        initiatorOrgId: oid,
                        targetOrgId: targetId,
                        followStatus: newStatus,
                    }, { transaction: tx });
                }

                return res;
            });
        })

    }
};