import { inTx } from '@openland/foundationdb';
import { withPermission, withAny, withAccount, withUser } from '../../openland-module-api/Resolvers';
import { IDs } from '../../openland-module-api/IDs';
import { QueryParser } from '../../openland-utils/QueryParser';
import { defined, emailValidator, stringNotEmpty, validate } from '../../openland-utils/NewInputValidator';
import { Sanitizer } from '../../openland-utils/Sanitizer';
import { Modules } from 'openland-modules/Modules';
import {
    ChannelInvitation,
    ChannelLink,
    Conversation,
} from 'openland-module-db/schema';
import { FDB } from 'openland-module-db/FDB';
import { buildBaseImageUrl } from 'openland-module-media/ImageRef';
import { GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
import { AppContext } from 'openland-modules/AppContext';

// NEVER: 'never',
//         MIN_15: '15min',
//         HOUR_1: '1hour',
//         HOUR_24: '24hour',
//         WEEK_1: '1week',
export default {
    ChannelMembershipStatus: {
        invited: 'invited',
        member: 'joined',
        requested: 'requested',
        none: 'left'
    },
    ChannelConversation: {
        id: (src) => IDs.Conversation.serialize(src.id),
        flexibleId: (src) => IDs.Conversation.serialize(src.id),
        title: async (src, args, ctx) => (await FDB.RoomProfile.findById(ctx, src.id))!.title,
        photos: () => [],
        members: () => [],
        unreadCount: async (src, args, ctx) => {
            return (FDB.UserDialogCounter.byId(ctx.auth.uid!, src.id)).get(ctx);
        },
        topMessage: async (src: Conversation, _: any, ctx: AppContext) => {
            if (!await Modules.Messaging.room.isRoomMember(ctx, ctx.auth.uid!, src.id!)) {
                return null;
            }

            return Modules.Messaging.findTopMessage(ctx, src.id!);
        },
        membersCount: (src, args, ctx) => Modules.Messaging.roomMembersCount(ctx, src.id),
        memberRequestsCount: (src, args, ctx) => Modules.Messaging.roomMembersCount(ctx, src.id, 'requested'),
        featured: async (src, args, ctx) => (await FDB.ConversationRoom.findById(ctx, src.id))!.featured || false,
        hidden: async (src, args, ctx) => !(await FDB.ConversationRoom.findById(ctx, src.id))!.listed || false,
        description: async (src, args, ctx) => (await FDB.RoomProfile.findById(ctx, src.id))!.description || '',
        longDescription: (src) => '',
        myStatus: async (src, args, ctx) => {
            let member = ctx.auth.uid ? await Modules.Messaging.room.findMembershipStatus(ctx, ctx.auth.uid, src.id!) : undefined;

            if (!member || member.status === 'kicked') {
                return 'left';
            }

            return member.status;
        },
        organization: async (src, args, ctx) => FDB.Organization.findById(ctx, (await FDB.ConversationRoom.findById(ctx, src.id))!.oid!),
        isRoot: (src) => false,
        settings: (src, args, ctx) => Modules.Messaging.getRoomSettings(ctx, ctx.auth.uid!, src.id),

        photo: async (src, args, ctx) => buildBaseImageUrl((await FDB.RoomProfile.findById(ctx, src.id))!.image),
        photoRef: async (src, args, ctx) => (await FDB.RoomProfile.findById(ctx, src.id))!.image,
        socialImage: async (src, args, ctx) => buildBaseImageUrl((await FDB.RoomProfile.findById(ctx, src.id))!.socialImage),
        socialImageRef: async (src, args, ctx) => (await FDB.RoomProfile.findById(ctx, src.id))!.socialImage,
        pinnedMessage: (src: Conversation) => null,
        membersOnline: async (src, args, ctx) => {
            let members = await Modules.Messaging.room.findConversationMembers(ctx, src.id);
            let onlines = await Promise.all(members.map(m => Modules.Presence.getLastSeen(ctx, m)));
            return onlines.filter(s => s === 'online').length;
        },
        myRole: async (src: Conversation, _: any, ctx: AppContext) => {
            let member = await Modules.Messaging.room.findMembershipStatus(ctx, ctx.auth.uid!, src.id!);
            return member && member.role;
        }
    },
    ChannelMember: {
        role: (src) => src.role,
        status: (src) => src.status === 'joined' ? 'member' : 'left',
        user: (src, args, ctx) => FDB.User.findById(ctx, src.uid)
    },
    ChannelInvite: {
        channel: (src: ChannelInvitation | ChannelLink, args: {}, ctx: AppContext) => FDB.Conversation.findById(ctx, src.channelId),
        invitedByUser: (src: ChannelInvitation | ChannelLink, args: {}, ctx: AppContext) => FDB.User.findById(ctx, src.creatorId)
    },

    Mutation: {
        alphaChannelCreate: withAccount(async (ctx, args, uid, oid) => {
            oid = args.oid ? IDs.Organization.parse(args.oid) : oid;
            await validate({
                title: defined(stringNotEmpty('Title cant be empty'))
            }, args);

            let imageRef = Sanitizer.sanitizeImageRef(args.photoRef);

            if (imageRef) {
                await Modules.Media.saveFile(ctx, imageRef.uuid);
            }
            return Modules.Messaging.room.createRoom(ctx, 'public', oid, uid, [], {
                title: args.title,
                image: imageRef,
                description: args.description
            });
        }),

        alphaChannelSetFeatured: withPermission('super-admin', async (ctx, args) => {
            let channelId = IDs.Conversation.parse(args.channelId);
            return await Modules.Messaging.room.setFeatured(ctx, channelId, args.featured);
        }),

        alphaChannelHideFromSearch: withPermission('super-admin', async (ctx, args) => {
            let channelId = IDs.Conversation.parse(args.channelId);
            return await Modules.Messaging.room.setListed(ctx, channelId, !args.hidden);
        }),

        alphaChannelInvite: withUser(async (ctx, args, uid) => {
            let channelId = IDs.Conversation.parse(args.channelId);
            let userId = IDs.User.parse(args.userId);
            return Modules.Messaging.room.inviteToRoom(ctx, channelId, uid, [userId]);
        }),
        alphaChannelJoin: withUser(async (ctx, args, uid) => {
            let channelId = IDs.Conversation.parse(args.channelId);
            let chat = await Modules.Messaging.room.joinRoom(ctx, channelId, uid);
            return {
                chat
            };
        }),
        alphaChannelInviteMembers: withUser(async (parent, args, uid) => {
            let channelId = IDs.Conversation.parse(args.channelId);
            await validate({
                inviteRequests: [{ email: defined(emailValidator) }]
            }, args);

            await inTx(parent, async (ctx) => {
                for (let inviteRequest of args.inviteRequests) {
                    await Modules.Invites.createRoomInvite(
                        ctx,
                        channelId,
                        uid,
                        inviteRequest.email,
                        inviteRequest.emailText || undefined,
                        inviteRequest.firstName || undefined,
                        inviteRequest.lastName || undefined
                    );
                }
            });

            return 'ok';
        }),
        alphaChannelRenewInviteLink: withUser(async (ctx, args, uid) => {
            let channelId = IDs.Conversation.parse(args.channelId);
            return await Modules.Invites.refreshRoomInviteLink(ctx, channelId, uid);
        }),
        alphaChannelJoinInvite: withAny(async (ctx, args) => {
            let uid = ctx.auth.uid;
            if (uid === undefined) {
                return;
            }
            return IDs.Conversation.serialize(await Modules.Invites.joinRoomInvite(ctx, uid, args.invite, (args.isNewUser !== null && args.isNewUser !== undefined) ? args.isNewUser : false));
        }),
    },

    Query: {
        alphaChannelMembers: withUser(async (ctx, args, uid) => {
            let convId = IDs.Conversation.parse(args.channelId);

            return await FDB.RoomParticipant.allFromActive(ctx, convId);
        }),

        alphaChannels: withUser(async (ctx, args, uid) => {
            let clauses: any[] = [];
            let sort: any[] | undefined = undefined;

            if (args.query || args.sort) {
                let parser = new QueryParser();
                parser.registerText('title', 'title');
                parser.registerBoolean('featured', 'featured');
                parser.registerText('createdAt', 'createdAt');
                parser.registerText('updatedAt', 'updatedAt');
                parser.registerText('membersCount', 'membersCount');

                if (args.query) {
                    clauses.push({ match_phrase_prefix: { title: args.query } });
                } else {
                    clauses.push({ term: { featured: true } });
                }

                if (args.sort) {
                    sort = parser.parseSort(args.sort);
                }
            }

            clauses.push({ term: { hidden: false } });

            let hits = await Modules.Search.elastic.client.search({
                index: 'channels',
                type: 'channel',
                size: args.first,
                from: args.after ? parseInt(args.after, 10) : (args.page ? ((args.page - 1) * args.first) : 0),
                body: {
                    sort: sort,
                    query: { bool: { must: clauses } }
                }
            });

            let ids = hits.hits.hits.map((v) => parseInt(v._id, 10));
            let channels = await Promise.all(ids.map((v) => FDB.Conversation.findById(ctx, v)));
            let offset = 0;
            if (args.after) {
                offset = parseInt(args.after, 10);
            } else if (args.page) {
                offset = (args.page - 1) * args.first;
            }
            let total = hits.hits.total;

            return {
                edges: channels.map((p, i) => {
                    return {
                        node: p,
                        cursor: (i + 1 + offset).toString()
                    };
                }),
                pageInfo: {
                    hasNextPage: (total - (offset + 1)) >= args.first, // ids.length === this.limitValue,
                    hasPreviousPage: false,

                    itemsCount: total,
                    pagesCount: Math.min(Math.floor(8000 / args.first), Math.ceil(total / args.first)),
                    currentPage: Math.floor(offset / args.first) + 1,
                    openEnded: true
                },
            };
        }),
        alphaChannelInviteInfo: withAny(async (ctx, args) => {
            return await Modules.Invites.resolveInvite(ctx, args.uuid);
        }),
        alphaChannelInviteLink: withUser(async (ctx, args, uid) => {
            let channelId = IDs.Conversation.parse(args.channelId);
            return await Modules.Invites.createRoomlInviteLink(ctx, channelId, uid);
        })
    }
} as GQLResolver;