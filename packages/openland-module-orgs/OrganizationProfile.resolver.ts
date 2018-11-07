import { Organization } from 'openland-module-db/schema';
import { IDs } from 'openland-server/api/utils/IDs';
import { FDB } from 'openland-module-db/FDB';

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
};