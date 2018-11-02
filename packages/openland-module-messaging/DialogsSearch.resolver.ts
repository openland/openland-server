import { FDB } from 'openland-module-db/FDB';
import { withAccount } from 'openland-server/api/utils/Resolvers';
import { DB } from 'openland-server/tables';
import { Modules } from 'openland-modules/Modules';
import { Message } from 'openland-module-db/schema';

export default {
    Query: {
        alphaChatTextSearch: withAccount<{ query: string }>(async (args, uid, oid) => {

            // GROUPS / CHANNELS has titles we can search 
            let searchableConversations = (await FDB.UserDialog.allFromUser(uid)).map((v) => v.cid);
            let sequelize = DB.connection;
            let groupsChannels = await DB.Conversation.findAll({
                where: {
                    type: {
                        $in: ['group', 'channel']
                    },
                    title: {
                        $ilike: '%' + args.query.toLowerCase() + '%'
                    },
                    id: {
                        $in: searchableConversations
                    }
                }
            });

            // PERSONAL - search users first, then matching conversations with current user
            let userIds = await Modules.Users.searchForUsers(args.query, { uid, limit: 50 });

            let personal = await DB.Conversation.findAll({
                where: [
                    sequelize.and(
                        {
                            type: 'private'
                        },
                        sequelize.or(
                            {
                                member1Id: uid,
                                member2Id: {
                                    $in: userIds
                                }
                            },
                            {
                                member2Id: uid,
                                member1Id: {
                                    $in: userIds
                                }
                            }
                        )
                    )
                ]
            });

            // SHARED search org1 matching name, org2 current and vice versa
            let orgs1 = await DB.Conversation.findAll({
                include: [
                    {
                        model: DB.Organization,
                        as: 'organization1',
                        required: true,
                        where: {
                            name: {
                                $ilike: '%' + args.query.toLowerCase() + '%'
                            }
                        }
                    },
                    {
                        model: DB.Organization,
                        as: 'organization2',
                        required: true,
                        where: {
                            id: oid
                        }
                    }
                ]
            });
            let orgs2 = await DB.Conversation.findAll({
                include: [
                    {
                        model: DB.Organization,
                        as: 'organization2',
                        required: true,
                        where: {
                            name: {
                                $ilike: '%' + args.query.toLowerCase() + '%'
                            }
                        }
                    },
                    {
                        model: DB.Organization,
                        as: 'organization1',
                        required: true,
                        where: {
                            id: oid
                        }
                    }
                ]
            });
            // ORG INNER CHATS
            let userAsMember = await DB.OrganizationMember.findAll({
                where: {
                    userId: uid
                }
            });
            let orgsIds = userAsMember.map(m => m.orgId);
            let orgsInner = await DB.Conversation.findAll({
                include: [
                    {
                        model: DB.Organization,
                        as: 'organization1',
                        required: true,
                        where: {
                            id: {
                                $in: orgsIds,
                            },
                            name: {
                                $ilike: '%' + args.query.toLowerCase() + '%'
                            }
                        }
                    },
                    {
                        model: DB.Organization,
                        as: 'organization2',
                        required: true,
                        where: {
                            id: {
                                $in: orgsIds,
                            },
                            name: {
                                $ilike: '%' + args.query.toLowerCase() + '%'
                            }
                        }
                    },
                ]
            });

            let res = [...personal, ...groupsChannels, ...orgs1, ...orgs2, ...orgsInner];
            res = res.reduce(
                (p, x) => {
                    if (!p.find(c => c.id === x.id)) {
                        p.push(x);
                    }
                    return p;
                },
                [] as any[]
            );
            let messages = new Map<number, Message | null>();
            for (let c of res) {
                let msg = await FDB.Message.rangeFromChat(c.id, 1, true);
                if (msg.length === 0) {
                    messages.set(c.id, null);
                } else {
                    messages.set(c.id, msg[0]);
                }
            }
            res = res.filter(c => messages.get(c.id))
                .sort((a, b) => {
                    let lastMessageA = messages.get(a.id);
                    let lastMessageB = messages.get(b.id);
                    return (lastMessageB ? new Date((lastMessageB as any).createdAt).getTime() : 0) - (lastMessageA ? new Date((lastMessageA as any).createdAt).getTime() : 0);
                });
            return res;

        }),
    }
};