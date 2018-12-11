import { Organization } from 'openland-module-db/schema';
import { IDs } from 'openland-module-api/IDs';
import { FDB } from 'openland-module-db/FDB';
import { buildBaseImageUrl } from 'openland-module-media/ImageRef';
import { Modules } from 'openland-modules/Modules';
import { withAny } from 'openland-module-api/Resolvers';
import { NotFoundError } from 'openland-errors/NotFoundError';
import { resolveOrganizationJoinedMembers, resolveOrganizationMembersWithStatus } from './utils/resolveOrganizationJoinedMembers';
import { AppContext } from 'openland-modules/AppContext';
import { GQLResolver } from '../../openland-module-api/schema/SchemaSpec';

export default {
    Organization: {
        id: (src: Organization) => IDs.Organization.serialize(src.id),
        isMine: (src: Organization, args: {}, ctx: AppContext) => ctx.auth.uid ? Modules.Orgs.isUserMember(ctx, ctx.auth.uid!, src.id) : false,

        name: async (src: Organization, args: {}, ctx: AppContext) => ((await FDB.OrganizationProfile.findById(ctx, src.id)))!.name,
        photo: async (src: Organization, args: {}, ctx: AppContext) => buildBaseImageUrl(((await FDB.OrganizationProfile.findById(ctx, src.id)))!.photo),

        website: async (src: Organization, args: {}, ctx: AppContext) => ((await FDB.OrganizationProfile.findById(ctx, src.id)))!.website,
        about: async (src: Organization, args: {}, ctx: AppContext) => ((await FDB.OrganizationProfile.findById(ctx, src.id)))!.about,
        twitter: async (src: Organization, args: {}, ctx: AppContext) => ((await FDB.OrganizationProfile.findById(ctx, src.id)))!.twitter,
        facebook: async (src: Organization, args: {}, ctx: AppContext) => ((await FDB.OrganizationProfile.findById(ctx, src.id)))!.facebook,
        linkedin: async (src: Organization, args: {}, ctx: AppContext) => ((await FDB.OrganizationProfile.findById(ctx, src.id)))!.linkedin,

        // Refactor?
        superAccountId: (src: Organization) => IDs.SuperAccount.serialize(src.id),
        alphaIsOwner: (src: Organization, args: {}, ctx: AppContext) => ctx.auth.uid ? Modules.Orgs.isUserAdmin(ctx, ctx.auth.uid!, src.id) : false,
        alphaOrganizationMembers: async (src: Organization, args: {}, ctx: AppContext) => await resolveOrganizationJoinedMembers(ctx, src.id),
        alphaOrganizationMemberRequests: async (src: Organization, args: {}, ctx: AppContext) => await resolveOrganizationMembersWithStatus(ctx, src.id, 'requested'),
        alphaFeatured: async (src: Organization, args: {}, ctx: AppContext) => ((await FDB.OrganizationEditorial.findById(ctx, src.id)))!.featured,
        alphaIsCommunity: (src: Organization) => src.kind === 'community',
        alphaCreatedChannels: async (src: Organization, args: {}, ctx: AppContext) => {
            return FDB.ConversationRoom.allFromOrganizationPublicRooms(ctx, src.id);
        },

        shortname: async (src: Organization, args: {}, ctx: AppContext) => {
            let shortName = await Modules.Shortnames.findOrganizationShortname(ctx, src.id);

            if (shortName) {
                return shortName.shortname;
            }

            return null;
        },
        betaPublicRooms: async (src: Organization, args: {}, ctx: AppContext) => {
            let isMember = ctx.auth.uid && ctx.auth.oid && await Modules.Orgs.isUserMember(ctx, ctx.auth.uid, ctx.auth.oid);
            return (await FDB.ConversationRoom.allFromOrganizationPublicRooms(ctx, src.id)).filter(r => isMember || r.listed);
        },
        status: async (src: Organization) => src.status
    },
    Query: {
        myOrganizations: async (_: any, args: {}, ctx: AppContext) => {
            if (ctx.auth.uid) {
                return (await Promise.all((await FDB.OrganizationMember.allFromUser(ctx, 'joined', ctx.auth.uid))
                    .map((v) => FDB.Organization.findById(ctx, v.oid))))
                    .filter((v) => v!.status !== 'suspended');
            }
            return [];
        },
        organization: withAny(async (ctx, args) => {
            let res = await FDB.Organization.findById(ctx, IDs.Organization.parse(args.id));
            if (!res) {
                throw new NotFoundError('Unable to find organization');
            }
            return res;
        }),
    }
} as GQLResolver;