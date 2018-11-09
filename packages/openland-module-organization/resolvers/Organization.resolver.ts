import { Organization } from 'openland-module-db/schema';
import { IDs } from 'openland-module-api/IDs';
import { CallContext } from 'openland-module-api/CallContext';
import { FDB } from 'openland-module-db/FDB';
import { buildBaseImageUrl } from 'openland-module-media/ImageRef';
import { Modules } from 'openland-modules/Modules';
import { withAny } from 'openland-module-api/Resolvers';
import { NotFoundError } from 'openland-errors/NotFoundError';
import { resolveOrganizationJoinedMembers } from './utils/resolveOrganizationJoinedMembers';

export default {
    Organization: {
        id: (src: Organization) => IDs.Organization.serialize(src.id),
        isMine: (src: Organization, args: {}, context: CallContext) => context.uid ?  Modules.Orgs.isUserMember(context.uid!, src.id) : false,

        name: async (src: Organization) => ((await FDB.OrganizationProfile.findById(src.id)))!.name,
        photo: async (src: Organization) => buildBaseImageUrl(((await FDB.OrganizationProfile.findById(src.id)))!.photo),

        website: async (src: Organization) => ((await FDB.OrganizationProfile.findById(src.id)))!.website,
        about: async (src: Organization) => ((await FDB.OrganizationProfile.findById(src.id)))!.about,
        twitter: async (src: Organization) => ((await FDB.OrganizationProfile.findById(src.id)))!.twitter,
        facebook: async (src: Organization) => ((await FDB.OrganizationProfile.findById(src.id)))!.facebook,
        linkedin: async (src: Organization) => ((await FDB.OrganizationProfile.findById(src.id)))!.linkedin,

        // Refactor?
        superAccountId: (src: Organization) => IDs.SuperAccount.serialize(src.id),
        alphaIsOwner: (src: Organization, args: {}, context: CallContext) => context.uid ? Modules.Orgs.isUserAdmin(context.uid!, src.id) : false,
        alphaOrganizationMembers: async (src: Organization) => await resolveOrganizationJoinedMembers(src.id),
        alphaFeatured: async (src: Organization) => ((await FDB.OrganizationEditorial.findById(src.id)))!.featured,
        alphaIsCommunity: (src: Organization) => src.kind === 'community',
        alphaCreatedChannels: async (src: Organization) => {
            return FDB.ConversationRoom.allFromOrganizationPublicRooms(src.id);
        },

        shortname: async (src: Organization) => {
            let shortName = await Modules.Shortnames.findOrganizationShortname(src.id);

            if (shortName) {
                return shortName.shortname;
            }

            return null;
        }
    },
    Query: {
        myOrganizations: async (_: any, args: {}, context: CallContext) => {
            if (context.uid) {
                return (await Promise.all((await FDB.OrganizationMember.allFromUser('joined', context.uid))
                    .map((v) => FDB.Organization.findById(v.oid))))
                    .filter((v) => v!.status !== 'suspended');
            }
            return [];
        },
        organization: withAny<{ id: string }>(async (args) => {
            let res = await FDB.Organization.findById(IDs.Organization.parse(args.id));
            if (!res) {
                throw new NotFoundError('Unable to find organization');
            }
            return res;
        }),
    }
};