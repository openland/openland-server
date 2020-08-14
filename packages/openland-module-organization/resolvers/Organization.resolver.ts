import { Context } from '@openland/context';
import { IDs } from 'openland-module-api/IDs';
import { Store } from 'openland-module-db/FDB';
import { buildBaseImageUrl } from 'openland-module-media/ImageRef';
import { Modules } from 'openland-modules/Modules';
import { withAny, withUser } from 'openland-module-api/Resolvers';
import { NotFoundError } from 'openland-errors/NotFoundError';
import { resolveOrganizationJoinedMembers, resolveOrganizationJoinedAdminMembers, resolveOrganizationMembersWithStatus } from './utils/resolveOrganizationJoinedMembers';
import { GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
import { Organization } from 'openland-module-db/store';
import { isDefined } from '../../openland-utils/misc';

const resolveOrganizationRooms = async (src: Organization, args: {}, ctx: Context) => {
    let haveAccess = src.kind === 'community' ? true : (ctx.auth.uid && ctx.auth.oid && await Modules.Orgs.isUserMember(ctx, ctx.auth.uid, src.id));
    if (!haveAccess) {
        return [];
    }
    if (src.status === 'deleted') {
        return [];
    }

    let rooms = await Store.ConversationRoom.organizationPublicRooms.findAll(ctx, src.id);
    let roomsFull = await Promise.all(rooms.map(async room => {
        let conv = await Store.Conversation.findById(ctx, room.id);
        if (conv && (conv.deleted || conv.archived)) {
            return null;
        }
        return { room, membersCount: await Modules.Messaging.roomMembersCount(ctx, room.id) };
    }));

    return roomsFull
        .filter(r => r !== null)
        .sort((a, b) => b!.membersCount - a!.membersCount)
        .map(r => r!.room);
};

export const Resolver: GQLResolver = {
    Organization: {
        id: (src: Organization) => IDs.Organization.serialize(src.id),
        isMine: (src: Organization, args: {}, ctx: Context) => ctx.auth.uid ? Modules.Orgs.isUserMember(ctx, ctx.auth.uid!, src.id) : false,
        isDeleted: (src: Organization) => src.status === 'deleted',

        name: async (src: Organization, args: {}, ctx: Context) => src.status === 'deleted' ? 'DELETED' : ((await Store.OrganizationProfile.findById(ctx, src.id)))!.name,
        photo: async (src: Organization, args: {}, ctx: Context) => src.status === 'deleted' ? null : buildBaseImageUrl(((await Store.OrganizationProfile.findById(ctx, src.id)))!.photo),

        website: async (src: Organization, args: {}, ctx: Context) => src.status === 'deleted' ? null : ((await Store.OrganizationProfile.findById(ctx, src.id)))!.website,
        about: async (src: Organization, args: {}, ctx: Context) => src.status === 'deleted' ? null : ((await Store.OrganizationProfile.findById(ctx, src.id)))!.about,
        twitter: async (src: Organization, args: {}, ctx: Context) => src.status === 'deleted' ? null : ((await Store.OrganizationProfile.findById(ctx, src.id)))!.twitter,
        facebook: async (src: Organization, args: {}, ctx: Context) => src.status === 'deleted' ? null : ((await Store.OrganizationProfile.findById(ctx, src.id)))!.facebook,
        linkedin: async (src: Organization, args: {}, ctx: Context) => src.status === 'deleted' ? null : ((await Store.OrganizationProfile.findById(ctx, src.id)))!.linkedin,
        instagram: async (src: Organization, args: {}, ctx: Context) => src.status === 'deleted' ? null : ((await Store.OrganizationProfile.findById(ctx, src.id)))!.instagram,

        betaIsOwner: (src: Organization, args: {}, ctx: Context) => ctx.auth.uid ? Modules.Orgs.isUserOwner(ctx, ctx.auth.uid!, src.id) : false,
        betaIsAdmin: (src: Organization, args: {}, ctx: Context) => ctx.auth.uid ? Modules.Orgs.isUserAdmin(ctx, ctx.auth.uid!, src.id) : false,
        betaIsPrimary: async (src: Organization, args: {}, ctx: Context) => ctx.auth.uid ? (await Store.UserProfile.findById(ctx, ctx.auth.uid))!.primaryOrganization === src.id : false,

        // Refactor?
        superAccountId: (src: Organization) => IDs.SuperAccount.serialize(src.id),
        alphaIsOwner: (src: Organization, args: {}, ctx: Context) => ctx.auth.uid ? Modules.Orgs.isUserAdmin(ctx, ctx.auth.uid!, src.id) : false,
        alphaOrganizationMembers: async (src, args, ctx) => {
            if (src.status === 'deleted') {
                return [];
            }
            return await resolveOrganizationJoinedMembers(ctx, {
                afterMemberId: args.after ? IDs.User.parse(args.after) : undefined,
                first: args.first
            }, src.id);
        },
        alphaOrganizationAdminMembers: async (src, args, ctx) => {
            if (src.status === 'deleted') {
                return [];
            }
            return await resolveOrganizationJoinedAdminMembers(ctx, {
                afterMemberId: args.after ? IDs.User.parse(args.after) : undefined,
                first: args.first
            }, src.id);
        },
        alphaOrganizationMemberRequests: async (src: Organization, args: {}, ctx: Context) => src.status === 'deleted' ? [] : await resolveOrganizationMembersWithStatus(ctx, src.id, 'requested'),
        alphaFeatured: async (src: Organization, args: {}, ctx: Context) => src.status === 'deleted' ? false : ((await Store.OrganizationEditorial.findById(ctx, src.id)))!.featured,
        alphaIsCommunity: (src: Organization) => src.kind === 'community',
        alphaIsPrivate: (src: Organization) => src.private || false,

        betaPublicRooms: resolveOrganizationRooms,
        betaPublicRoomsCount: async (src, args, ctx) => src.status === 'deleted' ? 0 : (await Store.ConversationRoom.organizationPublicRooms.findAll(ctx, src.id)).length,
        status: async (src: Organization) => src.status,
        membersCount: async (src: Organization, args: {}, ctx: Context) => src.status === 'deleted' ? 0 : ((await Store.OrganizationProfile.findById(ctx, src.id))!.joinedMembersCount || 0),
        personal: async (src: Organization) => src.personal || false,
        betaMembersCanInvite: async (src: Organization) => src.membersCanInvite || false,
    },
    Query: {
        myOrganizations: async (_: any, args: {}, ctx: Context) => {
            if (ctx.auth.uid) {
                return (await Promise.all((await Store.OrganizationMember.user.findAll(ctx, 'joined', ctx.auth.uid))
                    .map((v) => Store.Organization.findById(ctx, v.oid))))
                    .filter(isDefined)
                    .filter((v) => v!.status !== 'suspended' && v!.status !== 'deleted');
            }
            return [];
        },
        myCommunities: async (_: any, args: {}, ctx: Context) => {
            if (!ctx.auth.uid) {
                return [];
            }
            return (await Promise.all((await Store.OrganizationMember.user.findAll(ctx, 'joined', ctx.auth.uid))
                .map((v) => Store.Organization.findById(ctx, v.oid))))
                .filter(isDefined)
                .filter((v) => v!.status !== 'suspended' && v!.status !== 'deleted' && v.kind === 'community');
        },
        organization: withAny(async (ctx, args) => {
            let shortname = await Modules.Shortnames.findShortname(ctx, args.id);
            let orgId: number;

            if (shortname && shortname.enabled && shortname.ownerType === 'org') {
                orgId = shortname.ownerId;
            } else {
                orgId = IDs.Organization.parse(args.id);
            }

            let res = await Store.Organization.findById(ctx, orgId);
            if (!res) {
                throw new NotFoundError('Unable to find organization');
            }
            return res;
        }),
        organizationPublicRooms: withUser(async (ctx, args, uid) => {
            let orgId = IDs.Organization.parse(args.id);
            let org = await Store.Organization.findById(ctx, orgId);
            if (!org) {
                throw new NotFoundError();
            }

            let haveAccess = org.kind === 'community' ? true : await Modules.Orgs.isUserMember(ctx, uid, org.id);
            if (!haveAccess) {
                return {
                    items: [],
                    cursor: null
                };
            }

            let rooms = await Store.ConversationRoom.organizationPublicRooms.findAll(ctx, org.id);

            let roomsFull = await Promise.all(rooms.map(async room => {
                let conv = await Store.Conversation.findById(ctx, room.id);
                if (conv && (conv.deleted || conv.archived)) {
                    return null;
                }
                return { room, membersCount: await Modules.Messaging.roomMembersCount(ctx, room.id) };
            }));

            roomsFull = roomsFull
                .filter(r => r !== null)
                .sort((a, b) => b!.membersCount - a!.membersCount);

            if (args.after) {
                let afterId = IDs.Conversation.parse(args.after);
                let afterIndex = roomsFull.findIndex(r => r!.room.id === afterId);
                roomsFull = roomsFull.splice(afterIndex + 1);
            }

            let haveMore = roomsFull.length > args.first;

            roomsFull = roomsFull.splice(0, args.first);

            return {
                items: roomsFull.filter(isDefined).map(r => r!.room),
                cursor: haveMore ? IDs.Conversation.serialize(roomsFull[roomsFull.length - 1]!.room.id) : null
            };
        })
    }
};
