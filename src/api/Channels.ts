import { withAccount, withPermission, withAny } from './utils/Resolvers';
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
        topMessage: (src: Conversation) => DB.ConversationMessage.find({
            where: {
                conversationId: src.id,
            },
            order: [['id', 'DESC']]
        }),
        membersCount: (src: Conversation) => Repos.Chats.membersCountInConversation(src.id),
        featured: (src: Conversation) => src.extras.featured || false,
        description: (src: Conversation) => src.extras.description || '',
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
        alphaChannelCreate: withAccount<{ title: string, message: string, description?: string }>(async (args, uid, oid) => {
            await validate({
                title: defined(stringNotEmpty('Title cant be empty'))
            }, args);

            return await DB.txStable(async (tx) => {
                let chat = await DB.Conversation.create({
                    title: args.title.trim(),
                    type: 'channel',
                    extras: {
                        description: args.description || '',
                        creatorOrgId: oid
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
        alphaChannelInviteOrg: withAccount<{ channelId: string, orgId: string }>(async (args, uid, oid) => {
            return await DB.txStable(async (tx) => {
                let channelId = IDs.Conversation.parse(args.channelId);
                let orgId = IDs.Organization.parse(args.orgId);

                let member = await DB.ConversationChannelMembers.findOne({
                    where: {
                        conversationId: channelId,
                        orgId: orgId
                    },
                    transaction: tx
                });

                if (member) {
                    if (member.status === 'member' || member.status === 'invited') {
                        return 'ok';
                    } else if (member.status === 'requested') {
                        await member.update({ status: 'member' });
                        await Repos.Chats.sendMessage(
                            tx,
                            channelId,
                            uid,
                            {
                                message: `Organization ${orgId} joined to channel!`,
                                isService: true
                            }
                        );
                    }
                } else {
                    await DB.ConversationChannelMembers.create({
                        conversationId: channelId,
                        invitedByOrg: oid,
                        invitedByUser: uid,
                        orgId: orgId,
                        role: 'member',
                        status: 'invited'
                    }, { transaction: tx });
                }

                return 'ok';
            });
        }),
        alphaChannelJoinOrg: withAccount<{ channelId: string }>(async (args, uid, oid) => {
            return await DB.txStable(async (tx) => {
                let channelId = IDs.Conversation.parse(args.channelId);

                let member = await DB.ConversationChannelMembers.findOne({
                    where: {
                        conversationId: channelId,
                        orgId: oid
                    },
                    transaction: tx
                });

                if (member) {
                    if (member.status === 'member') {
                        return 'ok';
                    } else if (member.status === 'invited') {
                        await member.update({ status: 'member' });
                        await Repos.Chats.sendMessage(
                            tx,
                            channelId,
                            uid,
                            {
                                message: `Organization ${oid} joined to channel!`,
                                isService: true
                            }
                        );
                        return 'ok';
                    }
                } else {
                    await DB.ConversationChannelMembers.create({
                        conversationId: channelId,
                        invitedByOrg: oid,
                        invitedByUser: uid,
                        orgId: oid,
                        role: 'member',
                        status: 'requested'
                    }, { transaction: tx });
                }

                return 'ok';
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

                return 'ok';
            });
        }),

        alphaChannelInvite: withAccount<{ channelId: string, userId: string }>(async (args, uid, oid) => {
            return await DB.txStable(async (tx) => {
                let channelId = IDs.Conversation.parse(args.channelId);
                let userId = IDs.User.parse(args.userId);

                let member = await DB.ConversationGroupMembers.findOne({
                    where: {
                        conversationId: channelId,
                        userId
                    }
                });

                if (member) {
                    if (member.status === 'member' || member.status === 'invited') {
                        return 'ok';
                    } else if (member.status === 'requested') {
                        await member.update({ status: 'member' });
                        await Repos.Chats.sendMessage(
                            tx,
                            channelId,
                            uid,
                            {
                                message: `User ${userId} joined to channel!`,
                                isService: true
                            }
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

                return 'ok';
            });
        }),
        alphaChannelJoin: withAccount<{ channelId: string }>(async (args, uid, oid) => {
            return await DB.txStable(async (tx) => {
                let channelId = IDs.Conversation.parse(args.channelId);

                let member = await DB.ConversationGroupMembers.findOne({
                    where: {
                        conversationId: channelId,
                        userId: uid
                    },
                    transaction: tx
                });

                if (member) {
                    if (member.status === 'member') {
                        return 'ok';
                    } else if (member.status === 'invited') {
                        await member.update({ status: 'member' });
                        await Repos.Chats.sendMessage(
                            tx,
                            channelId,
                            uid,
                            {
                                message: `User ${uid} joined to channel!`,
                                isService: true
                            }
                        );
                        return 'ok';
                    }
                } else {
                    await DB.ConversationGroupMembers.create({
                        conversationId: channelId,
                        invitedById: uid,
                        role: 'member',
                        status: 'requested',
                        userId: uid,
                    }, { transaction: tx });
                }

                return 'ok';
            });
        }),
        alphaChannelRevokeInvite: withAccount<{ channelId: string, userId: string }>(async (args, uid, oid) => {
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
        alphaChannelCancelRequest: withAccount<{ channelId: string }>(async (args, uid, oid) => {
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
        alphaChannelInviteMembers: withAccount<{ channelId: string, inviteRequests: { email: string, emailText?: string, firstName?: string, lastName?: string }[] }>(async (args, uid, oid) => {
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
        alphaChannelRenewInviteLink: withAccount<{ channelId: string }>(async (args, uid, oid) => {
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

                await DB.ConversationGroupMembers.create({
                    conversationId: invite.channelId,
                    invitedById: uid,
                    role: 'member',
                    status: 'member',
                    userId: uid
                }, { transaction: tx });

                await Repos.Chats.sendMessage(
                    tx,
                    invite.channelId,
                    uid!,
                    {
                        message: `User ${uid} joined to channel!`,
                        isService: true
                    }
                );

                if (invite.isOneTime) {
                    await invite.update({ acceptedById: uid }, { transaction: tx });
                }

                return IDs.Conversation.serialize(invite.channelId);
            });
        }),
    },

    Query: {
        alphaChannelsList: withAccount<{ first: number, after?: string | null, seq?: number }>(async (args, uid, oid) => {
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
        alphaChannelMembersOrg: withAccount<{ channelId: string }>(async (args, uid, oid) => {
            let convId = IDs.Conversation.parse(args.channelId);

            return await DB.ConversationChannelMembers.findAll({
                where: {
                    conversationId: convId
                }
            });
        }),
        alphaChannelMembers: withAccount<{ channelId: string }>(async (args, uid, oid) => {
            let convId = IDs.Conversation.parse(args.channelId);

            return await DB.ConversationGroupMembers.findAll({
                where: {
                    conversationId: convId
                }
            });
        }),
        alphaChannelMyOrgInvites: withAccount<{}>(async (args, uid, oid) => {
            return await DB.ConversationChannelMembers.findAll({
                where: {
                    orgId: oid,
                    status: 'invited'
                }
            });
        }),
        alphaChannelJoinRequestsOrg: withAccount<{ channelId: string }>(async (args, uid, oid) => {
            let convId = IDs.Conversation.parse(args.channelId);

            return await DB.ConversationChannelMembers.findAll({
                where: {
                    status: 'requested',
                    conversationId: convId
                }
            });
        }),
        alphaChannelsFeatured: withAccount<{}>(async (args, uid, oid) => {
            return await DB.Conversation.findAll({
                where: {
                    type: 'channel',
                    extras: { featured: true }
                }
            });
        }),
        alphaChannels: withAccount<AlphaChannelsParams>(async (args, uid, oid) => {
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
                }

                if (args.sort) {
                    sort = parser.parseSort(args.sort);
                }
            }

            let hits = await ElasticClient.search({
                index: 'channels',
                type: 'channel',
                size: args.first,
                from: args.page ? ((args.page - 1) * args.first) : 0,
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
        alphaChannelInviteLink: withAccount<{ channelId: string }>(async (args, uid, oid) => {
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