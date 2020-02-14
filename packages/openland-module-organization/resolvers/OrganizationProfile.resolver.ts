import { IDs } from 'openland-module-api/IDs';
import { Store } from 'openland-module-db/FDB';
import { withAny, withUser, withAccount } from 'openland-module-api/Resolvers';
import { NotFoundError } from 'openland-errors/NotFoundError';
import { Modules } from 'openland-modules/Modules';
import { UserError } from 'openland-errors/UserError';
import { ErrorText } from 'openland-errors/ErrorText';
import { inTx } from '@openland/foundationdb';
import { stringNotEmpty, validate } from 'openland-utils/NewInputValidator';
import { Sanitizer } from 'openland-utils/Sanitizer';
import { AppContext } from 'openland-modules/AppContext';
import { GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
import { Organization } from 'openland-module-db/store';

export const Resolver: GQLResolver = {
    OrganizationProfile: {
        id: (src: Organization) => IDs.Organization.serialize(src.id),
        name: async (src: Organization, args: {}, ctx: AppContext) => ((await Store.OrganizationProfile.findById(ctx, src.id)))!.name,
        photoRef: async (src: Organization, args: {}, ctx: AppContext) => ((await Store.OrganizationProfile.findById(ctx, src.id)))!.photo,

        website: async (src: Organization, args: {}, ctx: AppContext) => ((await Store.OrganizationProfile.findById(ctx, src.id)))!.website,
        websiteTitle: (src: Organization, args: {}, ctx: AppContext) => null,
        about: async (src: Organization, args: {}, ctx: AppContext) => ((await Store.OrganizationProfile.findById(ctx, src.id)))!.about,
        twitter: async (src: Organization, args: {}, ctx: AppContext) => ((await Store.OrganizationProfile.findById(ctx, src.id)))!.twitter,
        facebook: async (src: Organization, args: {}, ctx: AppContext) => ((await Store.OrganizationProfile.findById(ctx, src.id)))!.facebook,
        linkedin: async (src: Organization, args: {}, ctx: AppContext) => ((await Store.OrganizationProfile.findById(ctx, src.id)))!.linkedin,
        instagram: async (src: Organization, args: {}, ctx: AppContext) => ((await Store.OrganizationProfile.findById(ctx, src.id)))!.instagram,

        alphaPublished: async (src: Organization, args: {}, ctx: AppContext) => ((await Store.OrganizationEditorial.findById(ctx, src.id)))!.listed,
        alphaEditorial: (src: Organization) => src.editorial,
        alphaFeatured: async (src: Organization, args: {}, ctx: AppContext) => ((await Store.OrganizationEditorial.findById(ctx, src.id)))!.featured,
        alphaIsCommunity: (src: Organization) => src.kind === 'community',
        alphaIsPrivate: (src: Organization) => src.private || false,
    },
    Query: {
        myOrganizationProfile: async (_: any, args: {}, ctx: AppContext) => {
            if (ctx.auth.oid) {
                return await Store.Organization.findById(ctx, ctx.auth.oid);
            }
            return null;
        },
        organizationProfile: withAny(async (ctx, args) => {
            // TODO: Fix permissions!11
            let res = await Store.Organization.findById(ctx, IDs.Organization.parse(args.id));
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
                orgId = IDs.Organization.parse(args.id);
            }

            let isSuper = ['super-admin', 'editor'].indexOf((await Modules.Super.superRole(parent, uid)) || 'none') > -1;

            let member = await Store.OrganizationMember.findById(parent, orgId, uid);
            let isMemberAdmin = (member !== null && member.status === 'joined' && member.role === 'admin');
            if (!isMemberAdmin && !isSuper) {
                throw new UserError(ErrorText.permissionOnlyOwner);
            }

            return await inTx(parent, async (ctx) => {
                let existing = await Store.Organization.findById(ctx, orgId);

                if (!existing) {
                    throw new UserError(ErrorText.unableToFindOrganization);
                }
                let isMemberOwner = uid === existing.ownerId;

                let profile = (await Store.OrganizationProfile.findById(ctx, orgId))!;

                if (args.input.name !== undefined) {
                    await validate(
                        stringNotEmpty(`Please enter a name for this ${existing.kind === 'organization' ? 'organization' : 'community'}`),
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
                if (args.input.instagram !== undefined) {
                    profile.instagram = Sanitizer.sanitizeString(args.input.instagram);
                }
                if (args.input.about !== undefined) {
                    profile.about = Sanitizer.sanitizeString(args.input.about);
                }
                if (args.input.alphaIsPrivate !== undefined && (isMemberOwner || isSuper)) {
                    existing.private = args.input.alphaIsPrivate;
                }

                let editorial = (await Store.OrganizationEditorial.findById(ctx, orgId))!;

                if (args.input.alphaPublished !== undefined && isSuper) {
                    editorial.listed = !!Sanitizer.sanitizeAny(args.input.alphaPublished);
                }

                if (args.input.alphaEditorial !== undefined && isSuper) {
                    existing.editorial = !!Sanitizer.sanitizeAny(args.input.alphaEditorial);
                }

                if (args.input.alphaFeatured !== undefined && isSuper) {
                    editorial.featured = !!Sanitizer.sanitizeAny(args.input.alphaFeatured);
                }

                // Schedule indexing
                await Modules.Orgs.markForUndexing(ctx, profile.id);
                // Index rooms
                let orgRooms = await Store.ConversationRoom.organizationPublicRooms.findAll(ctx, orgId);
                let profiles = await Promise.all(orgRooms.map(room => Store.RoomProfile.findById(ctx, room.id)));
                for (let roomProfile of profiles) {
                    if (roomProfile) {
                        await roomProfile!.flush(ctx);
                    }
                }

                // Call hook
                await editorial.flush(ctx);
                await profile.flush(ctx);
                await Modules.Hooks.onOrganizationProfileUpdated(ctx, profile.id);

                return existing;
            });
        }),
        deleteOrganization: withAccount(async (parent, args, uid, oid) => {
            return Modules.Orgs.deleteOrganization(parent, uid, IDs.Organization.parse(args.id));
        })
    }
};
