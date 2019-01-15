import { Organization } from 'openland-module-db/schema';
import { IDs } from 'openland-module-api/IDs';
import { FDB } from 'openland-module-db/FDB';
import { withAny, withUser, withAccount } from 'openland-module-api/Resolvers';
import { NotFoundError } from 'openland-errors/NotFoundError';
import { Modules } from 'openland-modules/Modules';
import { UserError } from 'openland-errors/UserError';
import { ErrorText } from 'openland-errors/ErrorText';
import { inTx } from 'foundation-orm/inTx';
import { stringNotEmpty, validate } from 'openland-utils/NewInputValidator';
import { Sanitizer } from 'openland-utils/Sanitizer';
import { AppContext } from 'openland-modules/AppContext';
import { GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
import { AccessDeniedError } from '../../openland-errors/AccessDeniedError';

export default {
    OrganizationProfile: {
        id: (src: Organization) => IDs.Organization.serialize(src.id),
        name: async (src: Organization, args: {}, ctx: AppContext) => ((await FDB.OrganizationProfile.findById(ctx, src.id)))!.name,
        photoRef: async (src: Organization, args: {}, ctx: AppContext) => ((await FDB.OrganizationProfile.findById(ctx, src.id)))!.photo,

        website: async (src: Organization, args: {}, ctx: AppContext) => ((await FDB.OrganizationProfile.findById(ctx, src.id)))!.website,
        websiteTitle: (src: Organization, args: {}, ctx: AppContext) => null,
        about: async (src: Organization, args: {}, ctx: AppContext) => ((await FDB.OrganizationProfile.findById(ctx, src.id)))!.about,
        twitter: async (src: Organization, args: {}, ctx: AppContext) => ((await FDB.OrganizationProfile.findById(ctx, src.id)))!.twitter,
        facebook: async (src: Organization, args: {}, ctx: AppContext) => ((await FDB.OrganizationProfile.findById(ctx, src.id)))!.facebook,
        linkedin: async (src: Organization, args: {}, ctx: AppContext) => ((await FDB.OrganizationProfile.findById(ctx, src.id)))!.linkedin,

        alphaPublished: async (src: Organization, args: {}, ctx: AppContext) => ((await FDB.OrganizationEditorial.findById(ctx, src.id)))!.listed,
        alphaEditorial: (src: Organization) => src.editorial,
        alphaFeatured: async (src: Organization, args: {}, ctx: AppContext) => ((await FDB.OrganizationEditorial.findById(ctx, src.id)))!.featured,
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
        myOrganizationProfile: async (_: any, args: {}, ctx: AppContext) => {
            if (ctx.auth.oid) {
                return await FDB.Organization.findById(ctx, ctx.auth.oid);
            }
            return null;
        },
        organizationProfile: withAny(async (ctx, args) => {
            // TODO: Fix permissions!11
            let res = await FDB.Organization.findById(ctx, IDs.Organization.parse(args.id));
            if (!res) {
                throw new NotFoundError('Unable to find organization');
            }
            return res;
        }),
    },
    Mutation: {
        createOrganization: withUser(async (ctx, args, uid) => {
            return await Modules.Orgs.createOrganization(ctx, uid, args.input);
        }),
        updateOrganizationProfile: withAccount(async (parent, args, uid, oid) => {

            let orgId = oid;
            if (args.id) {
                let role = await Modules.Super.superRole(parent, uid);
                if (!(role === 'super-admin' || role === 'editor')) {
                    throw new UserError(ErrorText.permissionOnlyOwner);
                }
                orgId = IDs.Organization.parse(args.id);
            } else {
                let member = await FDB.OrganizationMember.findById(parent, oid, uid);
                if (member === null || member.status !== 'joined' || member.role !== 'admin') {
                    throw new UserError(ErrorText.permissionOnlyOwner);
                }
            }

            return await inTx(parent, async (ctx) => {
                let existing = await FDB.Organization.findById(ctx, orgId);
                if (!existing) {
                    throw new UserError(ErrorText.unableToFindOrganization);
                }

                let profile = (await FDB.OrganizationProfile.findById(ctx, orgId))!;

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
                        await Modules.Media.saveFile(ctx, args.input.photoRef.uuid);
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

                if (args.input.alphaPublished !== undefined || args.input.alphaEditorial !== undefined || args.input.alphaFeatured !== undefined) {
                    if (!await Modules.Super.superRole(ctx, uid)) {
                        throw new AccessDeniedError();
                    }
                }
                let editorial = (await FDB.OrganizationEditorial.findById(ctx, orgId))!;

                if (args.input.alphaPublished !== undefined) {
                    editorial.listed = !!Sanitizer.sanitizeAny(args.input.alphaPublished);
                }

                if (args.input.alphaEditorial !== undefined) {
                    existing.editorial = !!Sanitizer.sanitizeAny(args.input.alphaEditorial);
                }

                if (args.input.alphaFeatured !== undefined) {
                    editorial.featured = !!Sanitizer.sanitizeAny(args.input.alphaFeatured);
                }

                // Schedule indexing
                await Modules.Orgs.markForUndexing(ctx, profile.id);

                // Call hook
                await editorial.flush();
                await profile.flush();
                await Modules.Hooks.onOrganizationProfileUpdated(ctx, profile.id);

                return existing;
            });
        }),
        deleteOrganization: withAccount(async (parent, args, uid, oid) => {
            return Modules.Orgs.deleteOrganization(parent, uid, IDs.Organization.parse(args.id));
        })
    }
} as GQLResolver;