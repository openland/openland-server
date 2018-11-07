import { Organization } from 'openland-module-db/schema';
import { IDs } from 'openland-server/api/utils/IDs';
import { Repos } from 'openland-server/repositories';
import { CallContext } from 'openland-server/api/utils/CallContext';
import { FDB } from 'openland-module-db/FDB';
import { buildBaseImageUrl } from 'openland-module-media/ImageRef';
import { Modules } from 'openland-modules/Modules';

export default {
    Organization: {
        id: (src: Organization) => IDs.Organization.serialize(src.id),
        superAccountId: (src: Organization) => IDs.SuperAccount.serialize(src.id),
        isMine: (src: Organization, args: {}, context: CallContext) => context.uid ? Repos.Organizations.isMemberOfOrganization(src.id!!, context.uid!!) : false,
        alphaIsOwner: (src: Organization, args: {}, context: CallContext) => context.uid ? Repos.Organizations.isOwnerOfOrganization(src.id!!, context.uid!!) : false,

        name: async (src: Organization) => ((await FDB.OrganizationProfile.findById(src.id)))!.name,
        photo: async (src: Organization) => buildBaseImageUrl(((await FDB.OrganizationProfile.findById(src.id)))!.photo),
        photoRef: async (src: Organization) => ((await FDB.OrganizationProfile.findById(src.id)))!.photo,

        website: async (src: Organization) => ((await FDB.OrganizationProfile.findById(src.id)))!.website,
        websiteTitle: (src: Organization) => null,
        about: async (src: Organization) => ((await FDB.OrganizationProfile.findById(src.id)))!.about,
        twitter: async (src: Organization) => ((await FDB.OrganizationProfile.findById(src.id)))!.twitter,
        facebook: async (src: Organization) => ((await FDB.OrganizationProfile.findById(src.id)))!.facebook,
        linkedin: async (src: Organization) => ((await FDB.OrganizationProfile.findById(src.id)))!.linkedin,

        alphaContacts: async (src: Organization) => [], // (await Repos.Organizations.getOrganizationContacts(src.id!!)).map(async (m) => await Modules.Users.profileById(m.uid)).filter(p => p),
        alphaOrganizationMembers: async (src: Organization) => await Repos.Organizations.getOrganizationJoinedMembers(src.id),
        alphaPublished: async (src: Organization) => ((await FDB.OrganizationEditorial.findById(src.id)))!.listed,
        alphaEditorial: (src: Organization) => src.editorial,
        alphaFeatured: async (src: Organization) => ((await FDB.OrganizationEditorial.findById(src.id)))!.featured,
        alphaIsCommunity: (src: Organization) => src.kind === 'community',

        alphaOrganizationType: (src: Organization) => [],

        alphaFollowed: async (src: Organization, args: {}, context: CallContext) => {
            return false;
        },

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
};