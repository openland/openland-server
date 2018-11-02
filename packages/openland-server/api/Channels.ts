import { withPermission, withAny, withAccount, withUser } from './utils/Resolvers';
import { DB } from '../tables';
import { Repos } from '../repositories';
import { Conversation } from '../tables/Conversation';
import { IDs } from './utils/IDs';
import { CallContext } from './utils/CallContext';
import { ElasticClient } from '../indexing';
import { QueryParser } from '../modules/QueryParser';
import { SelectBuilder } from '../modules/SelectBuilder';
import { defined, emailValidator, stringNotEmpty, validate } from '../modules/NewInputValidator';
import { ErrorText } from '../errors/ErrorText';
import { NotFoundError } from '../errors/NotFoundError';
import { buildBaseImageUrl, ImageRef } from '../repositories/Media';
import { Sanitizer } from '../modules/Sanitizer';
import { Services } from '../services';
import { Modules } from 'openland-modules/Modules';
import { inTx } from 'foundation-orm/inTx';
import { ChannelInvitation, ChannelLink, RoomParticipant } from 'openland-module-db/schema';
import { FDB } from 'openland-module-db/FDB';

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
export const Resolver = {
    ChannelMembershipStatus: {
        invited: 'invited',
        member: 'joined',
        requested: 'requested',
        none: 'left'
    },
    ChannelConversation: {
        id: (src: Conversation) => IDs.Conversation.serialize(src.id),
        flexibleId: (src: Conversation) => IDs.Conversation.serialize(src.id),
        title: (src: Conversation) => src.title,
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
        featured: (src: Conversation) => src.extras.featured || false,
        hidden: (src: Conversation) => src.extras.hidden || false,
        description: (src: Conversation) => src.extras.description || '',
        longDescription: (src: Conversation) => src.extras.longDescription || '',
        myStatus: async (src: Conversation, _: any, context: CallContext) => {
            let member = context.uid ? await Modules.Messaging.room.findMembershipStatus(context.uid, src.id!) : undefined;

            if (!member) {
                return 'left';
            }

            return member.status;
        },
        organization: (src: Conversation) => src.extras!.creatorOrgId ? DB.Organization.findById(src.extras!.creatorOrgId as number) : null,
        isRoot: (src: Conversation) => src.extras.isRoot || false,
        settings: (src: Conversation, _: any, context: CallContext) => Modules.Messaging.getConversationSettings(context.uid!!, src.id),

        photo: (src: Conversation) => src.extras && src.extras.picture ? buildBaseImageUrl(src.extras.picture as any) : null,
        photoRef: (src: Conversation) => src.extras && src.extras.picture,
        socialImage: (src: Conversation) => src.extras && src.extras.socialImage ? buildBaseImageUrl(src.extras.socialImage as any) : null,
        socialImageRef: (src: Conversation) => src.extras && src.extras.socialImage,
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
        user: (src: RoomParticipant) => DB.User.findById(src.uid)
    },
    ChannelInvite: {
        channel: (src: ChannelInvitation | ChannelLink) => DB.Conversation.findById(src.channelId),
        invitedByUser: (src: ChannelInvitation | ChannelLink) => DB.User.findById(src.creatorId)
    },

    Mutation: {
        alphaChannelCreate: withAccount<{ title: string, message?: string, photoRef?: ImageRef, description?: string, oid?: string }>(async (args, uid, oid) => {
            oid = args.oid ? IDs.Organization.parse(args.oid) : oid;
            await validate({
                title: defined(stringNotEmpty('Title cant be empty'))
            }, args);

            let imageRef = Sanitizer.sanitizeImageRef(args.photoRef);

            if (imageRef) {
                await Services.UploadCare.saveFile(imageRef.uuid);
            }

            let res = await DB.txStable(async (tx) => {

                let chat = await DB.Conversation.create({
                    title: args.title.trim(),
                    type: 'channel',
                    extras: {
                        description: args.description || '',
                        creatorOrgId: oid,
                        creatorId: uid,
                        ...(imageRef ? { extras: { picture: imageRef } } as any : {}),
                    }
                }, { transaction: tx });

                // await DB.ConversationChannelMembers.create({
                //     conversationId: chat.id,
                //     invitedByOrg: oid,
                //     invitedByUser: uid,
                //     orgId: oid,
                //     role: 'creator',
                //     status: 'member'
                // }, {transaction: tx});

                return chat;
            });

            await inTx(async () => {
                await FDB.RoomParticipant.create(res.id, uid, {
                    invitedBy: uid,
                    role: 'owner',
                    status: 'joined'
                }).then(async p => await p.flush());
            });

            if (args.message) {
                await Repos.Chats.sendMessage(res.id, uid, { message: args.message });
            } else {
                await Repos.Chats.sendMessage(res.id, uid, { message: 'Channel created', isService: true });
            }
            return res;
        }),

        alphaChannelSetFeatured: withPermission<{ channelId: string, featured: boolean }>('super-admin', (args) => {
            return DB.tx(async (tx) => {
                let channelId = IDs.Conversation.parse(args.channelId);

                let channel = await DB.Conversation.findById(channelId);

                if (!channel) {
                    return 'ok';
                }

                await channel.update({ extras: { ...channel.extras, featured: args.featured } });

                return channel;
            });
        }),

        alphaChannelHideFromSearch: withPermission<{ channelId: string, hidden: boolean }>('super-admin', (args) => {
            return DB.tx(async (tx) => {
                let channelId = IDs.Conversation.parse(args.channelId);

                let channel = await DB.Conversation.findById(channelId);

                if (!channel) {
                    return 'ok';
                }

                await channel.update({ extras: { ...channel.extras, hidden: args.hidden } });

                return channel;
            });
        }),

        alphaChannelInvite: withUser<{ channelId: string, userId: string }>(async (args, uid) => {
            return await inTx(async () => {
                let channelId = IDs.Conversation.parse(args.channelId);
                let userId = IDs.User.parse(args.userId);
                let channel = await DB.Conversation.findById(channelId);

                let membership = await FDB.RoomParticipant.findById(channelId, userId);

                if (membership) {
                    if (membership.status === 'joined') {
                        return {
                            chat: channel,
                            curSeq: channel!.seq
                        };
                    } else {
                        membership.status = 'joined';
                        let name = (await Modules.Users.profileById(userId))!.firstName;
                        await Repos.Chats.sendMessage(
                            channelId,
                            userId,
                            {
                                message: `${name} has joined the channel!`,
                                isService: true,
                                isMuted: true,
                                serviceMetadata: {
                                    type: 'user_invite',
                                    userIds: [userId],
                                    invitedById: uid
                                }
                            }
                        );
                    }
                } else {
                    await FDB.RoomParticipant.create(channelId, uid, {
                        invitedBy: uid,
                        role: 'member',
                        status: 'joined'
                    });
                }

                return {
                    chat: channel,
                    curSeq: channel!.seq
                };
            });
            // return await DB.txStable(async (tx) => {

            //     let member = await DB.ConversationGroupMembers.findOne({
            //         where: {
            //             conversationId: channelId,
            //             userId
            //         },
            //         transaction: tx,
            //         lock: tx.LOCK.UPDATE
            //     });

            //     if (member) {
            //         if (member.status === 'member' || member.status === 'invited') {
            //             return {
            //                 chat: channel,
            //                 curSeq: channel!.seq
            //             };
            //         } else if (member.status === 'requested') {
            //             await member.update({ status: 'member' }, { transaction: tx });

            //             let name = (await Modules.Users.profileById(userId))!.firstName;

            //             await Repos.Chats.sendMessage(
            //                 channelId,
            //                 userId,
            //                 {
            //                     message: `${name} has joined the channel!`,
            //                     isService: true,
            //                     isMuted: true,
            //                     serviceMetadata: {
            //                         type: 'user_invite',
            //                         userIds: [userId],
            //                         invitedById: uid
            //                     }
            //                 }
            //             );

            //             // let membersCount = await Repos.Chats.membersCountInConversation(channelId);

            //             // await Repos.Chats.addUserEventsInConversation(
            //             //     channelId,
            //             //     uid,
            //             //     'new_members_count',
            //             //     {
            //             //         conversationId: channelId,
            //             //         membersCount: membersCount + 1
            //             //     },
            //             //     tx
            //             // );
            //         }
            //     } else {
            //         await DB.ConversationGroupMembers.create({
            //             conversationId: channelId,
            //             invitedById: uid,
            //             role: 'member',
            //             status: 'invited'
            //         }, { transaction: tx });
            //     }

            //     await channel!.reload({ transaction: tx });

            //     return {
            //         chat: channel,
            //         curSeq: channel!.seq
            //     };
            // });
        }),
        alphaChannelJoin: withUser<{ channelId: string }>(async (args, uid) => {
            // return await DB.txStable(async (tx) => {
            //     let channelId = IDs.Conversation.parse(args.channelId);
            //     let channel = await DB.Conversation.findById(channelId, { transaction: tx });

            //     let member = await DB.ConversationGroupMembers.findOne({
            //         where: {
            //             conversationId: channelId,
            //             userId: uid
            //         },
            //         transaction: tx
            //     });

            //     let org = channel && channel.extras!.creatorOrgId ? await DB.Organization.findById(channel.extras!.creatorOrgId as number) : null;
            //     let orgMember = undefined;
            //     if (org) {
            //         orgMember = await DB.OrganizationMember.find({
            //             where: {
            //                 userId: uid,
            //                 orgId: org.id
            //             }
            //         });
            //     }

            //     if (member) {
            //         if (member.status === 'member') {
            //             return {
            //                 chat: channel,
            //                 curSeq: channel!.seq
            //             };
            //         } else if (member.status === 'invited') {
            //             await member.update({ status: 'member' }, { transaction: tx });

            //             let name = (await Modules.Users.profileById(uid))!.firstName;

            //             await Repos.Chats.sendMessage(
            //                 channelId,
            //                 uid,
            //                 {
            //                     message: `${name} has joined the channel!`,
            //                     isService: true,
            //                     isMuted: true,
            //                     serviceMetadata: {
            //                         type: 'user_invite',
            //                         userIds: [uid],
            //                         invitedById: uid
            //                     }
            //                 }
            //             );

            //             // let membersCount = await Repos.Chats.membersCountInConversation(channelId);

            //             // await Repos.Chats.addUserEventsInConversation(
            //             //     channelId,
            //             //     uid,
            //             //     'new_members_count',
            //             //     {
            //             //         conversationId: channelId,
            //             //         membersCount: membersCount + 1
            //             //     },
            //             //     tx
            //             // );
            //         }
            //     } else if (orgMember) {
            //         let name = (await Modules.Users.profileById(uid))!.firstName;
            //         await DB.ConversationGroupMembers.create({
            //             conversationId: channelId,
            //             invitedById: uid,
            //             role: 'admin',
            //             status: 'member',
            //             userId: uid,
            //         }, { transaction: tx });

            //         await Repos.Chats.sendMessage(
            //             channelId,
            //             uid,
            //             {
            //                 message: `${name} has joined the channel!`,
            //                 isService: true,
            //                 isMuted: true,
            //                 serviceMetadata: {
            //                     type: 'user_invite',
            //                     userIds: [uid],
            //                     invitedById: uid
            //                 }
            //             }
            //         );
            //         return {
            //             chat: channel,
            //             curSeq: channel!.seq
            //         };
            //     } else {
            //         await DB.ConversationGroupMembers.create({
            //             conversationId: channelId,
            //             invitedById: uid,
            //             role: 'member',
            //             status: 'requested',
            //             userId: uid,
            //         }, { transaction: tx });
            //     }

            //     await channel!.reload({ transaction: tx });

            //     return {
            //         chat: channel,
            //         curSeq: channel!.seq
            //     };
            // });
            return await inTx(async () => {
                let channelId = IDs.Conversation.parse(args.channelId);
                let userId = uid;
                let channel = await DB.Conversation.findById(channelId);

                let membership = await FDB.RoomParticipant.findById(channelId, userId);

                if (membership) {
                    if (membership.status === 'joined') {
                        return {
                            chat: channel,
                            curSeq: channel!.seq
                        };
                    } else {
                        membership.status = 'joined';
                        let name = (await Modules.Users.profileById(userId))!.firstName;
                        await Repos.Chats.sendMessage(
                            channelId,
                            userId,
                            {
                                message: `${name} has joined the channel!`,
                                isService: true,
                                isMuted: true,
                                serviceMetadata: {
                                    type: 'user_invite',
                                    userIds: [userId],
                                    invitedById: uid
                                }
                            }
                        );
                    }
                } else {
                    await FDB.RoomParticipant.create(channelId, uid, {
                        invitedBy: uid,
                        role: 'member',
                        status: 'joined'
                    });
                }

                return {
                    chat: channel,
                    curSeq: channel!.seq
                };
            });
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
                let user = await DB.User.find({
                    where: {
                        id: uid
                    }
                });
                if (user) {
                    user.status = 'ACTIVATED';

                    // User set invitedBy if none
                    if (invite.creatorId && !user.invitedBy) {
                        user.invitedBy = invite.creatorId;
                    }

                    await user.save();
                }

                if (context.oid !== undefined) {
                    // Activate organization
                    let org = await DB.Organization.find({
                        where: {
                            id: context.oid
                        }
                    });
                    if (org) {
                        org.status = 'ACTIVATED';
                        await org.save();
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

        alphaChannelsFeatured: withUser<{}>(async (args, uid) => {
            return await DB.Conversation.findAll({
                where: {
                    type: 'channel',
                    extras: { featured: true }
                }
            });
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

            let hits = await ElasticClient.search({
                index: 'channels',
                type: 'channel',
                size: args.first,
                from: args.after ? parseInt(args.after, 10) : (args.page ? ((args.page - 1) * args.first) : 0),
                body: {
                    sort: sort,
                    query: { bool: { must: clauses } }
                }
            });

            let builder = new SelectBuilder(DB.Conversation)
                .after(args.after)
                .page(args.page)
                .limit(args.first);

            return await builder.findElastic(hits);
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