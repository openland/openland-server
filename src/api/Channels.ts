import { withAccount, withPermission } from './utils/Resolvers';
import { DB } from '../tables';
import { Repos } from '../repositories';
import { Conversation } from '../tables/Conversation';
import { IDs } from './utils/IDs';
import { CallContext } from './utils/CallContext';
import { ConversationChannelMember } from '../tables/ConversationChannelMembers';
import { ElasticClient } from '../indexing';
import { buildElasticQuery, QueryParser } from '../modules/QueryParser';
import { SelectBuilder } from '../modules/SelectBuilder';
import { ConversationGroupMember } from '../tables/ConversationGroupMembers';

interface AlphaChannelsParams {
    orgId: string;
    query?: string;
    first: number;
    after?: string;
    page?: number;
}

export const Resolver = {
    ChannelConversation: {
        id: (src: Conversation) => IDs.Conversation.serialize(src.id),
        flexibleId: (src: Conversation) => IDs.Conversation.serialize(src.id),
        title: (src: Conversation) => src.title,
        photos: () => [],
        members: () => [],
        unreadCount: async (src: Conversation, _: any, context: CallContext) => {
            let state = await DB.ConversationUserState.find({where: {conversationId: src.id, userId: context.uid!!}});
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
        isRoot: (src: Conversation) => src.extras.isRoot || false
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

    ChannelInvite: {
        channel: (src: ConversationChannelMember) => DB.Conversation.findById(src.conversationId),
        invitedByOrg: (src: ConversationChannelMember) => DB.Organization.findById(src.orgId),
        invitedByUser: (src: ConversationChannelMember) => DB.User.findById(src.invitedByUser)
    },

    ChannelJoinRequestOrg: {
        user: (src: ConversationChannelMember) => DB.User.findById(src.invitedByUser),
        organization: (src: ConversationChannelMember) => DB.Organization.findById(src.orgId),
    },

    Mutation: {
        alphaChannelCreate: withAccount<{ title: string, message: string, description?: string }>(async (args, uid, oid) => {
            return await DB.txStable(async (tx) => {
                let chat = await DB.Conversation.create({
                    title: args.title,
                    type: 'channel',
                    extras: {
                        description: args.description || '',
                        creatorOrgId: oid
                    }
                }, {transaction: tx});

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
                }, {transaction: tx});

                await Repos.Chats.sendMessage(tx, chat.id, uid, {message: args.message});

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
                        await member.update({status: 'member'});
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
                    }, {transaction: tx});
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
                        await member.update({status: 'member'});
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
                    }, {transaction: tx});
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

                await channel.update({ extras: {...channel.extras, featured: args.featured } });

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
                        await member.update({status: 'member'});
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
                    }, {transaction: tx});
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
                        await member.update({status: 'member'});
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
                        status: 'requested'
                    }, {transaction: tx});
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
    },

    Query: {
        alphaChannelsList: withAccount<{ first: number, after?: string | null, seq?: number }>(async (args, uid, oid) => {
            return await DB.tx(async (tx) => {
                let global = await DB.ConversationsUserGlobal.find({where: {userId: uid}, transaction: tx});
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

            if (args.query) {
                let parser = new QueryParser();
                parser.registerText('title', 'title');
                parser.registerBoolean('featured', 'featured');
                let parsed = parser.parseQuery(args.query);
                let elasticQuery = buildElasticQuery(parsed);
                clauses.push(elasticQuery);
            }

            let hits = await ElasticClient.search({
                index: 'channels',
                type: 'channel',
                size: args.first,
                from: args.page ? ((args.page - 1) * args.first) : 0,
                body: {
                    query: { bool: { must: clauses } }
                }
            });

            let builder = new SelectBuilder(DB.Conversation)
                .after(args.after)
                .page(args.page)
                .limit(args.first);

            return await builder.findElastic(hits);
        }),
    }
};