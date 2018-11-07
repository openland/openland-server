import { withPermission, withAny, withAccount, withUser } from '../openland-server/api/utils/Resolvers';
import { Repos } from '../openland-server/repositories';
import { IDs } from '../openland-server/api/utils/IDs';
import { CallContext } from '../openland-server/api/utils/CallContext';
import { QueryParser } from '../openland-server/modules/QueryParser';
import { defined, emailValidator, stringNotEmpty, validate } from '../openland-server/modules/NewInputValidator';
import { ErrorText } from '../openland-server/errors/ErrorText';
import { NotFoundError } from '../openland-server/errors/NotFoundError';
import { Sanitizer } from '../openland-server/modules/Sanitizer';
import { Modules } from 'openland-modules/Modules';
import { inTx } from 'foundation-orm/inTx';
import { ChannelInvitation, ChannelLink, RoomParticipant, Conversation } from 'openland-module-db/schema';
import { FDB } from 'openland-module-db/FDB';
import { buildBaseImageUrl, ImageRef } from 'openland-module-media/ImageRef';
import { Emails } from '../openland-server/services/Emails';

interface AlphaChannelsParams {
    orgId: string;
    query?: string;
    first: number;
    after?: string;
    page?: number;
    sort?: string;
}
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
        id: (src: Conversation) => IDs.Conversation.serialize(src.id),
        flexibleId: (src: Conversation) => IDs.Conversation.serialize(src.id),
        title: async (src: Conversation) => (await FDB.RoomProfile.findById(src.id))!.title,
        photos: () => [],
        members: () => [],
        unreadCount: async (src: Conversation, _: any, context: CallContext) => {
            let state = await FDB.UserDialog.findById(context.uid!!, src.id);
            if (state) {
                return state.unread;
            } else {
                return 0;
            }
        },
        topMessage: async (src: Conversation, _: any, context: CallContext) => {
            if (!await Modules.Messaging.room.isActiveMember(context.uid!, src.id!)) {
                return null;
            }

            return Modules.Messaging.repo.findTopMessage(src.id!);
        },
        membersCount: (src: Conversation) => Repos.Chats.membersCountInConversation(src.id),
        memberRequestsCount: (src: Conversation) => Repos.Chats.membersCountInConversation(src.id, 'requested'),
        featured: async (src: Conversation) => (await FDB.ConversationRoom.findById(src.id))!.featured || false,
        hidden: async (src: Conversation) => !(await FDB.ConversationRoom.findById(src.id))!.listed || false,
        description: async (src: Conversation) => (await FDB.RoomProfile.findById(src.id))!.description || '',
        longDescription: (src: Conversation) => '',
        myStatus: async (src: Conversation, _: any, context: CallContext) => {
            let member = context.uid ? await Modules.Messaging.room.findMembershipStatus(context.uid, src.id!) : undefined;

            if (!member || member.status === 'kicked') {
                return 'left';
            }

            return member.status;
        },
        organization: async (src: Conversation) => FDB.Organization.findById((await FDB.ConversationRoom.findById(src.id))!.oid!),
        isRoot: (src: Conversation) => false,
        settings: (src: Conversation, _: any, context: CallContext) => Modules.Messaging.getConversationSettings(context.uid!!, src.id),

        photo: async (src: Conversation) => buildBaseImageUrl((await FDB.RoomProfile.findById(src.id))!.image),
        photoRef: async (src: Conversation) => (await FDB.RoomProfile.findById(src.id))!.image,
        socialImage: async (src: Conversation) => buildBaseImageUrl((await FDB.RoomProfile.findById(src.id))!.socialImage),
        socialImageRef: async (src: Conversation) => (await FDB.RoomProfile.findById(src.id))!.socialImage,
        pinnedMessage: (src: Conversation) => null,
        membersOnline: async (src: Conversation) => {
            // let res = await DB.ConversationGroupMembers.findAll({
            //     where: {
            //         conversationId: src.id
            //     },
            //     order: ['userId']
            // });
            // let users = await Promise.all(res.map((v) => DB.User.findById(v.userId)));

            // let now = Date.now();
            // let online = users.map(user => {
            //     if (user!.lastSeen) {
            //         return user!.lastSeen!.getTime() > now;
            //     } else {
            //         return false;
            //     }
            // });

            // return online.filter(o => o === true).length;
            return 0;
        },
        myRole: async (src: Conversation, _: any, ctx: CallContext) => {
            let member = await Modules.Messaging.room.findMembershipStatus(ctx.uid!, src.id!);
            return member && member.role;
        }
    },
    ChannelMember: {
        role: (src: RoomParticipant) => src.role,
        status: (src: RoomParticipant) => src.status === 'joined' ? 'member' : 'left',
        user: (src: RoomParticipant) => FDB.User.findById(src.uid)
    },
    ChannelInvite: {
        channel: (src: ChannelInvitation | ChannelLink) => FDB.Conversation.findById(src.channelId),
        invitedByUser: (src: ChannelInvitation | ChannelLink) => FDB.User.findById(src.creatorId)
    },

    Mutation: {
        alphaChannelCreate: withAccount<{ title: string, message?: string, photoRef?: ImageRef, description?: string, oid?: string }>(async (args, uid, oid) => {
            oid = args.oid ? IDs.Organization.parse(args.oid) : oid;
            await validate({
                title: defined(stringNotEmpty('Title cant be empty'))
            }, args);

            let imageRef = Sanitizer.sanitizeImageRef(args.photoRef);

            if (imageRef) {
                await Modules.Media.saveFile(imageRef.uuid);
            }
            return Modules.Messaging.conv.createRoom('public', oid, uid, [], {
                title: args.title,
                image: imageRef,
                description: args.description
            });
        }),

        alphaChannelSetFeatured: withPermission<{ channelId: string, featured: boolean }>('super-admin', async (args) => {
            let channelId = IDs.Conversation.parse(args.channelId);
            return await Modules.Messaging.conv.setFeatured(channelId, args.featured);
        }),

        alphaChannelHideFromSearch: withPermission<{ channelId: string, hidden: boolean }>('super-admin', async (args) => {
            let channelId = IDs.Conversation.parse(args.channelId);
            return await Modules.Messaging.conv.setListed(channelId, !args.hidden);
        }),

        alphaChannelInvite: withUser<{ channelId: string, userId: string }>(async (args, uid) => {
            let channelId = IDs.Conversation.parse(args.channelId);
            let userId = IDs.User.parse(args.userId);
            return Modules.Messaging.conv.inviteToRoom(channelId, uid, [userId]);
        }),
        alphaChannelJoin: withUser<{ channelId: string }>(async (args, uid) => {
            let channelId = IDs.Conversation.parse(args.channelId);
            let chat = await Modules.Messaging.conv.joinRoom(channelId, uid);
            return {
                chat
            };
        }),
        alphaChannelInviteMembers: withUser<{ channelId: string, inviteRequests: { email: string, emailText?: string, firstName?: string, lastName?: string }[] }>(async (args, uid) => {
            let channelId = IDs.Conversation.parse(args.channelId);
            await validate({
                inviteRequests: [{ email: defined(emailValidator) }]
            }, args);

            await inTx(async () => {
                for (let inviteRequest of args.inviteRequests) {
                    await Modules.Messaging.createChannelInvite(channelId, uid,
                        inviteRequest.email, inviteRequest.emailText, inviteRequest.firstName, inviteRequest.lastName);
                }
            });

            return 'ok';
        }),
        alphaChannelRenewInviteLink: withUser<{ channelId: string }>(async (args, uid) => {
            let channelId = IDs.Conversation.parse(args.channelId);
            return await Modules.Messaging.refreshChannelInviteLink(channelId, uid);
        }),
        alphaChannelJoinInvite: withAny<{ invite: string }>(async (args, context) => {
            let uid = context.uid;
            if (uid === undefined) {
                return;
            }
            return await inTx(async () => {
                let invite = await Modules.Messaging.resolveInvite(args.invite);

                if (!invite) {
                    throw new NotFoundError(ErrorText.unableToFindInvite);
                }

                let existing = await FDB.RoomParticipant.findById(invite.channelId, uid!);

                if (existing) {
                    await Repos.Chats.addToChannel(invite.channelId, uid!);
                    return IDs.Conversation.serialize(invite.channelId);
                }

                // Activate user
                let user = (await FDB.User.findById(uid!))!;
                if (user) {
                    await Emails.sendWelcomeEmail(user!.id);
                    user.status = 'activated';

                    // User set invitedBy if none
                    if (invite.creatorId && !user.invitedBy) {
                        user.invitedBy = invite.creatorId;
                    }
                }

                if (context.oid !== undefined) {
                    // Activate organization
                    let org = (await FDB.Organization.findById(context.oid!))!;
                    if (org) {
                        org.status = 'activated';
                    }
                }

                try {
                    await FDB.RoomParticipant.create(invite.channelId, uid!, {
                        role: 'member',
                        status: 'joined',
                        invitedBy: uid!
                    }).then(async p => await p.flush());

                    let name = (await Modules.Users.profileById(uid!))!.firstName;

                    await Repos.Chats.sendMessage(
                        invite.channelId,
                        uid!,
                        {
                            message: `${name} has joined the channel!`,
                            isService: true,
                            isMuted: true,
                            serviceMetadata: {
                                type: 'user_invite',
                                userIds: [uid],
                                invitedById: invite.creatorId || uid
                            }
                        }
                    );

                    if (invite instanceof ChannelInvitation) {
                        invite.acceptedById = uid!;
                        invite.enabled = false;
                    }

                    return IDs.Conversation.serialize(invite.channelId);
                } catch (e) {
                    console.warn(e);
                    throw e;
                }
            });
        }),
    },

    Query: {
        alphaChannelMembersOrg: withUser<{ channelId: string }>(async (args, uid) => {
            // let convId = IDs.Conversation.parse(args.channelId);

            // return await DB.ConversationChannelMembers.findAll({
            //     where: {
            //         conversationId: convId
            //     }
            // });
            return [];
        }),
        alphaChannelMembers: withUser<{ channelId: string }>(async (args, uid) => {
            let convId = IDs.Conversation.parse(args.channelId);

            return await FDB.RoomParticipant.allFromActive(convId);
        }),

        alphaChannels: withUser<AlphaChannelsParams>(async (args, uid) => {
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
            let channels = await Promise.all(ids.map((v) => FDB.Conversation.findById(v)));
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
        alphaChannelInviteInfo: withAny<{ uuid: string }>(async (args, context: CallContext) => {
            return await Modules.Messaging.resolveInvite(args.uuid);
        }),
        alphaChannelInviteLink: withUser<{ channelId: string }>(async (args, uid) => {
            let channelId = IDs.Conversation.parse(args.channelId);
            return await Modules.Messaging.createChannelInviteLink(channelId, uid);
        })
    }
};