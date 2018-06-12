import { DB } from '../tables';
import { Organization } from '../tables/Organization';
import { IDs } from './utils/IDs';
import { buildBaseImageUrl } from '../repositories/Media';
import { withUser, withAccount } from './utils/Resolvers';
import { Repos } from '../repositories';
import { ImageRef } from '../repositories/Media';
import { CallContext } from './utils/CallContext';
import { OrganizationExtras } from '../repositories/OrganizationExtras';
import { UserError } from '../errors/UserError';
import { ErrorText } from '../errors/ErrorText';

let amIOwner = async (oid: number, uid: number) => {
    let member = await DB.OrganizationMember.find({
        where: {
            orgId: oid,
            userId: uid,
        }
    });
    return member && member.isOwner;
};

export const Resolver = {
    OrganizationProfile: {
        id: (src: Organization) => IDs.OrganizationAccount.serialize(src.id!!),
        iAmOwner: (src: Organization, args: {}, context: CallContext) => amIOwner(src.id!!, context.uid!!),
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
    Query: {
        alphaCurrentOrganizationProfile: withAccount(async (args, uid, oid) => {
            return await DB.Organization.findById(oid);
        }),

        alphaOrganizationProfile: withAccount<{ id: string }>(async (args, uid, oid) => {
            return await DB.Organization.findById(IDs.OrganizationAccount.parse(args.id));
        }),
    },
    Mutation: {

        alphaCreateOrganization: withUser<{ title: string, website?: string, logo?: ImageRef }>(async (args, uid) => {
            return await DB.tx(async (tx) => {
                let organization = await DB.Organization.create({
                    name: args.title.trim(),
                    website: args.website ? args.website.trim() : null,
                    photo: args.logo,
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
        })

    }
};