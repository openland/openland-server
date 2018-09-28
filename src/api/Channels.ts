import { withPermission, withAny, withAccount, withUser } from './utils/Resolvers';
import { DB } from '../tables';
import { Repos } from '../repositories';
import { Conversation } from '../tables/Conversation';
import { IDs } from './utils/IDs';
import { CallContext } from './utils/CallContext';
import { ConversationChannelMember } from '../tables/ConversationChannelMembers';
import { ElasticClient } from '../indexing';
import { QueryParser } from '../modules/QueryParser';
import { SelectBuilder } from '../modules/SelectBuilder';
import { ConversationGroupMember } from '../tables/ConversationGroupMembers';
import { defined, emailValidator, stringNotEmpty, validate } from '../modules/NewInputValidator';
import { ErrorText } from '../errors/ErrorText';
import { UserError } from '../errors/UserError';
import { Emails } from '../services/Emails';
import { randomInviteKey } from '../utils/random';
import { NotFoundError } from '../errors/NotFoundError';
import { ChannelInvite } from '../tables/ChannelInvite';
import { buildBaseImageUrl } from '../repositories/Media';

interface AlphaChannelsParams {
    orgId: string;
    query?: string;
    first: number;
    after?: string;
    page?: number;
    sort?: string;
}

export const Resolver = {
    ChannelConversation: {
        id: (src: Conversation) => IDs.Conversation.serialize(src.id),
        flexibleId: (src: Conversation) => IDs.Conversation.serialize(src.id),
        title: (src: Conversation) => src.title,
        photos: () => [],
        members: () => [],
        unreadCount: async (src: Conversation, _: any, context: CallContext) => {
            let state = await DB.ConversationUserState.find({ where: { conversationId: src.id, userId: context.uid!! } });
            if (state) {
                return state.unread;
            } else {
                return 0;
            }
        },
        topMessage: async (src: Conversation, _: any, context: CallContext) => {
            let member = await DB.ConversationGroupMembers.find({
                where: {
                    conversationId: src.id,
                    userId: context.uid,
                    status: 'member'
                }
            });

            if (!member) {
                return null;
            }

            return await DB.ConversationMessage.find({
                where: {
                    conversationId: src.id,
                },
                order: [['id', 'DESC']]
            });
        },
        membersCount: (src: Conversation) => Repos.Chats.membersCountInConversation(src.id),
        memberRequestsCount: (src: Conversation) => Repos.Chats.membersCountInConversation(src.id, 'requested'),
        featured: (src: Conversation) => src.extras.featured || false,
        hidden: (src: Conversation) => src.extras.hidden || false,
        description: (src: Conversation) => src.extras.description || '',
        longDescription: (src: Conversation) => src.extras.longDescription || '',
        myStatus: async (src: Conversation, _: any, context: CallContext) => {
            let member = await DB.ConversationGroupMembers.findOne({
                where: {
                    conversationId: src.id,
                    userId: context.uid
                }
            });

            if (!member) {
                return 'none';
            }

            return member.status;
        },
        organization: (src: Conversation) => src.extras!.creatorOrgId ? DB.Organization.findById(src.extras!.creatorOrgId as number) : null,
        isRoot: (src: Conversation) => src.extras.isRoot || false,
        settings: (src: Conversation, _: any, context: CallContext) => Repos.Chats.getConversationSettings(context.uid!!, src.id),

        photo: (src: Conversation) => src.extras && src.extras.picture ? buildBaseImageUrl(src.extras.picture as any) : null,
        photoRef: (src: Conversation) => src.extras && src.extras.picture,
        socialImage: (src: Conversation) => src.extras && src.extras.socialImage ? buildBaseImageUrl(src.extras.socialImage as any) : null,
        socialImageRef: (src: Conversation) => src.extras && src.extras.socialImage,
    },

    ChannelMemberOrg: {
        role: (src: ConversationChannelMember) => src.role,
        status: (src: ConversationChannelMember) => src.status,
        organization: (src: ConversationChannelMember) => DB.Organization.findById(src.orgId)
    },

    ChannelMember: {
        role: (src: ConversationGroupMember) => src.role,
        status: (src: ConversationGroupMember) => src.status,
        user: (src: ConversationGroupMember) => DB.User.findById(src.userId)
    },

    ChannelOrgInvite: {
        channel: (src: ConversationChannelMember) => DB.Conversation.findById(src.conversationId),
        invitedByOrg: (src: ConversationChannelMember) => DB.Organization.findById(src.orgId),
        invitedByUser: (src: ConversationChannelMember) => DB.User.findById(src.invitedByUser)
    },

    ChannelInvite: {
        channel: (src: ChannelInvite) => DB.Conversation.findById(src.channelId),
        invitedByUser: (src: ChannelInvite) => DB.User.findById(src.creatorId)
    },

    ChannelJoinRequestOrg: {
        user: (src: ConversationChannelMember) => DB.User.findById(src.invitedByUser),
        organization: (src: ConversationChannelMember) => DB.Organization.findById(src.orgId),
    },

    Mutation: {
        alphaChannelCreate: withAccount<{ title: string, message: string, description?: string, oid?: string }>(async (args, uid, oid) => {
            oid = args.oid ? IDs.Organization.parse(args.oid) : oid;
            await validate({
                title: defined(stringNotEmpty('Title cant be empty'))
            }, args);

            return await DB.txStable(async (tx) => {
                let chat = await DB.Conversation.create({
                    title: args.title.trim(),
                    type: 'channel',
                    extras: {
                        description: args.description || '',
                        creatorOrgId: oid,
                        creatorId: uid
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

                await DB.ConversationGroupMembers.create({
                    conversationId: chat.id,
                    invitedById: uid,
                    role: 'creator',
                    status: 'member',
                    userId: uid
                }, { transaction: tx });

                await Repos.Chats.sendMessage(tx, chat.id, uid, { message: args.message });

                return chat;
            });
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
            return await DB.txStable(async (tx) => {
                let channelId = IDs.Conversation.parse(args.channelId);
                let userId = IDs.User.parse(args.userId);
                let channel = await DB.Conversation.findById(channelId, { transaction: tx });

                let member = await DB.ConversationGroupMembers.findOne({
                    where: {
                        conversationId: channelId,
                        userId
                    },
                    transaction: tx,
                    lock: tx.LOCK.UPDATE
                });

                if (member) {
                    if (member.status === 'member' || member.status === 'invited') {
                        return {
                            chat: channel,
                            curSeq: channel!.seq
                        };
                    } else if (member.status === 'requested') {
                        await member.update({ status: 'member' }, { transaction: tx });

                        let name = (await DB.UserProfile.find({ where: { userId: userId } }))!.firstName;

                        await Repos.Chats.sendMessage(
                            tx,
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

                        let membersCount = await Repos.Chats.membersCountInConversation(channelId);

                        await Repos.Chats.addUserEventsInConversation(
                            channelId,
                            uid,
                            'new_members_count',
                            {
                                conversationId: channelId,
                                membersCount: membersCount + 1
                            },
                            tx
                        );
                    }
                } else {
                    await DB.ConversationGroupMembers.create({
                        conversationId: channelId,
                        invitedById: uid,
                        role: 'member',
                        status: 'invited'
                    }, { transaction: tx });
                }

                await channel!.reload({ transaction: tx });

                return {
                    chat: channel,
                    curSeq: channel!.seq
                };
            });
        }),
        alphaChannelJoin: withUser<{ channelId: string }>(async (args, uid) => {
            return await DB.txStable(async (tx) => {
                let channelId = IDs.Conversation.parse(args.channelId);
                let channel = await DB.Conversation.findById(channelId, { transaction: tx });

                let member = await DB.ConversationGroupMembers.findOne({
                    where: {
                        conversationId: channelId,
                        userId: uid
                    },
                    transaction: tx
                });

                let org = channel && channel.extras!.creatorOrgId ? await DB.Organization.findById(channel.extras!.creatorOrgId as number) : null;
                let orgMember = undefined;
                if (org) {
                    orgMember = await DB.OrganizationMember.find({
                        where: {
                            userId: uid,
                            orgId: org.id
                        }
                    });
                }

                if (member) {
                    if (member.status === 'member') {
                        return {
                            chat: channel,
                            curSeq: channel!.seq
                        };
                    } else if (member.status === 'invited') {
                        await member.update({ status: 'member' }, { transaction: tx });

                        let name = (await DB.UserProfile.find({ where: { userId: uid } }))!.firstName;

                        await Repos.Chats.sendMessage(
                            tx,
                            channelId,
                            uid,
                            {
                                message: `${name} has joined the channel!`,
                                isService: true,
                                isMuted: true,
                                serviceMetadata: {
                                    type: 'user_invite',
                                    userIds: [uid],
                                    invitedById: uid
                                }
                            }
                        );

                        let membersCount = await Repos.Chats.membersCountInConversation(channelId);

                        await Repos.Chats.addUserEventsInConversation(
                            channelId,
                            uid,
                            'new_members_count',
                            {
                                conversationId: channelId,
                                membersCount: membersCount + 1
                            },
                            tx
                        );
                    }
                } else if (orgMember) {
                    let name = (await DB.UserProfile.find({ where: { userId: uid } }))!.firstName;
                    await DB.ConversationGroupMembers.create({
                        conversationId: channelId,
                        invitedById: uid,
                        role: 'admin',
                        status: 'member',
                        userId: uid,
                    }, { transaction: tx });

                    await Repos.Chats.sendMessage(
                        tx,
                        channelId,
                        uid,
                        {
                            message: `${name} has joined the channel!`,
                            isService: true,
                            isMuted: true,
                            serviceMetadata: {
                                type: 'user_invite',
                                userIds: [uid],
                                invitedById: uid
                            }
                        }
                    );
                    return {
                        chat: channel,
                        curSeq: channel!.seq
                    };
                } else {
                    await DB.ConversationGroupMembers.create({
                        conversationId: channelId,
                        invitedById: uid,
                        role: 'member',
                        status: 'requested',
                        userId: uid,
                    }, { transaction: tx });
                }

                await channel!.reload({ transaction: tx });

                return {
                    chat: channel,
                    curSeq: channel!.seq
                };
            });
        }),
        alphaChannelRevokeInvite: withUser<{ channelId: string, userId: string }>(async (args, uid) => {
            return await DB.txStable(async (tx) => {
                let userId = IDs.User.parse(args.userId);
                let channelId = IDs.Conversation.parse(args.channelId);

                await DB.ConversationGroupMembers.destroy({
                    where: {
                        userId,
                        conversationId: channelId,
                        status: 'invited'
                    }
                });

                return 'ok';
            });
        }),
        alphaChannelCancelRequest: withUser<{ channelId: string }>(async (args, uid) => {
            return await DB.txStable(async (tx) => {
                let channelId = IDs.Conversation.parse(args.channelId);

                await DB.ConversationGroupMembers.destroy({
                    where: {
                        uid,
                        conversationId: channelId,
                        status: 'requested'
                    }
                });

                return 'ok';
            });
        }),
        alphaChannelInviteMembers: withUser<{ channelId: string, inviteRequests: { email: string, emailText?: string, firstName?: string, lastName?: string }[] }>(async (args, uid) => {
            await validate(
                {
                    inviteRequests: [
                        {
                            email: defined(emailValidator),
                        }
                    ]
                },
                args
            );

            return await DB.txStable(async (tx) => {
                let channelId = IDs.Conversation.parse(args.channelId);

                for (let inviteRequest of args.inviteRequests) {
                    let isDuplicate = !!await DB.ChannelInvite.findOne({
                        where: {
                            channelId,
                            forEmail: inviteRequest.email
                        }, transaction: tx
                    });

                    if (isDuplicate) {
                        throw new UserError(ErrorText.inviteAlreadyExists);
                    }

                    let invite = await DB.ChannelInvite.create({
                        uuid: randomInviteKey(),
                        channelId,
                        creatorId: uid,
                        memberFirstName: inviteRequest.firstName || '',
                        memberLastName: inviteRequest.lastName || '',
                        forEmail: inviteRequest.email,
                        emailText: inviteRequest.emailText
                    }, { transaction: tx });

                    await Emails.sendChannelInviteEmail(channelId, invite, tx);
                }

                return 'ok';
            });
        }),
        alphaChannelRenewInviteLink: withUser<{ channelId: string }>(async (args, uid) => {
            let channelId = IDs.Conversation.parse(args.channelId);
            return await DB.tx(async (tx) => {
                let existing = await DB.ChannelInvite.find({
                    where: {
                        channelId,
                        creatorId: uid,
                        isOneTime: false
                    },
                    transaction: tx
                });
                if (existing) {
                    await existing.destroy({ transaction: tx });
                }
                let invite = await DB.ChannelInvite.create({
                    uuid: randomInviteKey(),
                    channelId,
                    creatorId: uid,
                    isOneTime: false,
                }, { transaction: tx });

                return invite.uuid;
            });
        }),
        alphaChannelJoinInvite: withAny<{ invite: string }>(async (args, context) => {
            let uid = context.uid;
            if (uid === undefined) {
                return;
            }
            return await DB.txStable(async (tx) => {

                let invite = await DB.ChannelInvite.findOne({
                    where: {
                        uuid: args.invite,
                        acceptedById: null
                    },
                    transaction: tx
                });

                if (!invite) {
                    throw new NotFoundError(ErrorText.unableToFindInvite);
                }

                let existing = await DB.ConversationGroupMembers.findOne({
                    where: {
                        userId: uid,
                        conversationId: invite.channelId
                    },
                    transaction: tx
                });

                if (existing) {
                    await Repos.Chats.addToChannel(tx, invite.channelId, uid!);
                    return IDs.Conversation.serialize(invite.channelId);
                }

                // Activate user
                let user = await DB.User.find({
                    where: {
                        id: uid
                    },
                    lock: tx.LOCK.UPDATE,
                    transaction: tx
                });
                if (user) {
                    user.status = 'ACTIVATED';

                    // User set invitedBy if none
                    if (invite.creatorId && !user.invitedBy) {
                        user.invitedBy = invite.creatorId;
                    }

                    await user.save({ transaction: tx });
                    await Repos.Chats.addToInitialChannel(user.id!, tx);

                }

                if (context.oid !== undefined) {
                    // Activate organization
                    let org = await DB.Organization.find({
                        where: {
                            id: context.oid
                        },
                        lock: tx.LOCK.UPDATE,
                        transaction: tx
                    });
                    if (org) {
                        org.status = 'ACTIVATED';
                        await org.save({ transaction: tx });
                    }
                }

                try {
                    await DB.ConversationGroupMembers.create({
                        conversationId: invite.channelId,
                        invitedById: uid,
                        role: 'member',
                        status: 'member',
                        userId: uid
                    }, { transaction: tx });

                    let name = (await DB.UserProfile.find({ where: { userId: uid }, transaction: tx }))!.firstName;

                    await Repos.Chats.sendMessage(
                        tx,
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

                    if (invite.isOneTime) {
                        await invite.update({ acceptedById: uid }, { transaction: tx });
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
        alphaChannelsList: withUser<{ first: number, after?: string | null, seq?: number }>(async (args, uid) => {
            return await DB.tx(async (tx) => {
                let global = await DB.ConversationsUserGlobal.find({ where: { userId: uid }, transaction: tx });
                let seq = global ? global.seq : 0;
                if (args.seq !== undefined && args.seq !== null && args.seq !== seq) {
                    throw new Error('Inconsistent request');
                }
                let conversations = await DB.ConversationUserState.findAll({
                    where: {
                        userId: uid,
                        ...args.after ? {
                            updatedAt: {
                                $lte: args.after
                            }
                        } : {},
                    },
                    order: [['updatedAt', 'DESC']],
                    limit: args.first + 1,
                    include: [{
                        model: DB.Conversation,
                        as: 'conversation',
                        where: {
                            type: 'channel'
                        }
                    }]
                });
                return {
                    conversations: conversations.map((v) => v.conversation!!).filter((c, i) => i < args.first),
                    seq: seq,
                    next: conversations.length > args.first ? conversations[args.first - 1].updatedAt : null,
                    counter: uid
                };
            });
        }),
        alphaChannelMembersOrg: withUser<{ channelId: string }>(async (args, uid) => {
            let convId = IDs.Conversation.parse(args.channelId);

            return await DB.ConversationChannelMembers.findAll({
                where: {
                    conversationId: convId
                }
            });
        }),
        alphaChannelMembers: withUser<{ channelId: string }>(async (args, uid) => {
            let convId = IDs.Conversation.parse(args.channelId);

            return await DB.ConversationGroupMembers.findAll({
                where: {
                    conversationId: convId
                }
            });
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
            return await DB.ChannelInvite.find({ where: { uuid: args.uuid } });
        }),
        alphaChannelInviteLink: withUser<{ channelId: string }>(async (args, uid) => {
            let channelId = IDs.Conversation.parse(args.channelId);
            return await DB.tx(async (tx) => {
                let existing = await DB.ChannelInvite.find({
                    where: {
                        channelId,
                        creatorId: uid,
                        isOneTime: false
                    },
                    transaction: tx
                });
                if (existing) {
                    return existing.uuid;
                }
                let invite = await DB.ChannelInvite.create({
                    uuid: randomInviteKey(),
                    channelId,
                    creatorId: uid,
                    isOneTime: false,
                }, { transaction: tx });

                return invite.uuid;
            });
        })
    }
};