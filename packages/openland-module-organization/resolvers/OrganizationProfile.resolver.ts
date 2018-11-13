import { Organization } from 'openland-module-db/schema';
import { IDs } from 'openland-module-api/IDs';
import { FDB } from 'openland-module-db/FDB';
import { CallContext } from 'openland-module-api/CallContext';
import { withAny, withUser, withAccount } from 'openland-module-api/Resolvers';
import { NotFoundError } from 'openland-errors/NotFoundError';
import { Modules } from 'openland-modules/Modules';
import { UserError } from 'openland-errors/UserError';
import { ErrorText } from 'openland-errors/ErrorText';
import { inTx } from 'foundation-orm/inTx';
import { stringNotEmpty, validate } from 'openland-utils/NewInputValidator';
import { Sanitizer } from 'openland-utils/Sanitizer';
import { GQL } from '../../openland-module-api/schema/SchemaSpec';

export default {
    OrganizationProfile: {
        id: (src: Organization) => IDs.Organization.serialize(src.id),
        name: async (src: Organization) => ((await FDB.OrganizationProfile.findById(src.id)))!.name,
        photoRef: async (src: Organization) => ((await FDB.OrganizationProfile.findById(src.id)))!.photo,

        website: async (src: Organization) => ((await FDB.OrganizationProfile.findById(src.id)))!.website,
        websiteTitle: (src: Organization) => null,
        about: async (src: Organization) => ((await FDB.OrganizationProfile.findById(src.id)))!.about,
        twitter: async (src: Organization) => ((await FDB.OrganizationProfile.findById(src.id)))!.twitter,
        facebook: async (src: Organization) => ((await FDB.OrganizationProfile.findById(src.id)))!.facebook,
        linkedin: async (src: Organization) => ((await FDB.OrganizationProfile.findById(src.id)))!.linkedin,

        alphaPublished: async (src: Organization) => ((await FDB.OrganizationEditorial.findById(src.id)))!.listed,
        alphaEditorial: (src: Organization) => src.editorial,
        alphaFeatured: async (src: Organization) => ((await FDB.OrganizationEditorial.findById(src.id)))!.featured,
        alphaIsCommunity: (src: Organization) => src.kind === 'community',

        alphaOrganizationType: (src: Organization) => [],

        alphaJoinedChannels: async (src: Organization) => {
            return [];
        },
        alphaCreatedChannels: async (src: Organization) => {
            return [];
        }
    },
    Query: {
        myOrganizationProfile: async (_: any, args: {}, context: CallContext) => {
            if (context.oid) {
                return await FDB.Organization.findById(context.oid);
            }
            return null;
        },
        organizationProfile: withAny<GQL.QueryOrganizationProfileArgs>(async (args) => {
            // TODO: Fix permissions!11
            let res = await FDB.Organization.findById(IDs.Organization.parse(args.id));
            if (!res) {
                throw new NotFoundError('Unable to find organization');
            }
            return res;
        }),
    },
    Mutation: {
        createOrganization: withUser<GQL.MutationCreateOrganizationArgs>(async (args, uid) => {
            return await Modules.Orgs.createOrganization(uid, args.input);
        }),
        updateOrganizationProfile: withAccount<GQL.MutationUpdateOrganizationProfileArgs>(async (args, uid, oid) => {

            let orgId = oid;
            if (args.id) {
                let role = await Modules.Super.superRole(uid);
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
                        await Modules.Media.saveFile(args.input.photoRef.uuid);
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

                // Call hook
                await editorial.flush();
                await profile.flush();
                await Modules.Hooks.onOrganizationProfileUpdated(profile.id);

                return existing;
            });
        }),
    }
};