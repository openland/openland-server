import { Organization } from 'openland-module-db/schema';
import { IDs } from 'openland-module-api/IDs';
import { CallContext } from 'openland-module-api/CallContext';
import { FDB } from 'openland-module-db/FDB';
import { buildBaseImageUrl } from 'openland-module-media/ImageRef';
import { Modules } from 'openland-modules/Modules';
import { withAny, withPermission } from 'openland-module-api/Resolvers';
import { NotFoundError } from 'openland-errors/NotFoundError';
import { inTx } from 'foundation-orm/inTx';
import { UserError } from 'openland-errors/UserError';
import { ErrorText } from 'openland-errors/ErrorText';
import { resolveOrganizationJoinedMembers } from './utils/resolveOrganizationJoinedMembers';

export default {
    Organization: {
        id: (src: Organization) => IDs.Organization.serialize(src.id),
        superAccountId: (src: Organization) => IDs.SuperAccount.serialize(src.id),
        isMine: (src: Organization, args: {}, context: CallContext) => context.uid ?  Modules.Orgs.isUserMember(context.uid!, src.id) : false,
        alphaIsOwner: (src: Organization, args: {}, context: CallContext) => context.uid ? Modules.Orgs.isUserAdmin(context.uid!, src.id) : false,

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
        alphaOrganizationMembers: async (src: Organization) => await resolveOrganizationJoinedMembers(src.id),
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
    Query: {
        myOrganization: async (_: any, args: {}, context: CallContext) => {
            if (context.oid) {
                return await FDB.Organization.findById(context.oid);
            }
            return null;
        },
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
    },
    Mutation: {
        alphaAlterPublished: withPermission<{ id: string, published: boolean }>(['super-admin', 'editor'], async (args) => {
            return await inTx(async () => {
                let org = await FDB.Organization.findById(IDs.Organization.parse(args.id));
                if (!org) {
                    throw new UserError(ErrorText.unableToFindOrganization);
                }
                let editorial = await FDB.OrganizationEditorial.findById(org.id);
                editorial!.listed = args.published;
                return org;
            });
        }),
    }
};