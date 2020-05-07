import { withAny, withPermission, withUser } from '../openland-module-api/Resolvers';
import { Modules } from 'openland-modules/Modules';
import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { debugTask } from '../openland-utils/debugTask';
import { inTx } from '@openland/foundationdb';
import { Store } from 'openland-module-db/FDB';
import { getLeaderboardsChatId, getSuperNotificationsBotId } from './workers/utils';
import { boldString, buildMessage, heading, insaneString, MessagePart } from '../openland-utils/MessageBuilder';
import { Organization } from '../openland-module-db/store';
import { IDs } from '../openland-module-api/IDs';

export const Resolver: GQLResolver = {
    Query: {
        trendingRoomsByMessages: withAny( async (ctx, args) => {
            return await Modules.Stats.getTrendingRoomsByMessages(ctx, args.from.getTime(), args.to.getTime(), args.size || undefined);
        }),
        groupScreenViews: withUser(async (ctx, args, uid) => {
            let cid = IDs.Conversation.parse(args.id);
            return await Modules.Stats.getGroupScreenViewsByPeriod(ctx, cid, args.from, args.to);
        }),
    },
    Mutation: {
        createHistoricUserMetricsReport: withPermission('super-admin', async (parent, args) => {
            let chatId = await getLeaderboardsChatId(parent);
            let botId = await getSuperNotificationsBotId(parent);
            if (!chatId || !botId) {
                return false;
            }

            debugTask(parent.auth.uid!, 'historic-metrics-report', async (log) => {
                let threeLikeGivers = 0;
                let threeLikeGetters = 0;

                let likesGivenByUsers = new Map<number, number>();
                let likesGotByUsers = new Map<number, number>();

                let haveMore = true;
                let afterCursor: string | undefined = undefined;
                let totalCount = 0;
                let listedChatsCache = new Map<number, boolean>();
                while (haveMore) {
                    await inTx(parent, async ctx => {
                        let batchResult = await Store.Message.updated.query(ctx, {
                            afterCursor,
                            limit: 5000
                        });

                        for (let message of batchResult.items) {
                            if (!listedChatsCache.has(message.cid)) {
                                let room = await Store.ConversationRoom.findById(ctx, message.cid);
                                if (!room) {
                                    listedChatsCache.set(message.cid, false);
                                    continue;
                                }

                                let org: Organization | null = null;
                                if (room.oid) {
                                    org = (await Store.Organization.findById(ctx, room.oid!))!;
                                }

                                let isListed = room.kind === 'public' && org && org.kind === 'community' && !org.private;
                                listedChatsCache.set(message.cid, !!isListed);
                            }
                            if (!listedChatsCache.get(message.cid)) {
                                continue;
                            }
                            if (message.reactions) {
                                for (let reaction of message.reactions) {
                                    likesGivenByUsers.set(reaction.userId, (likesGivenByUsers.get(reaction.userId) || 0) + 1);
                                    likesGotByUsers.set(message.uid, (likesGotByUsers.get(message.uid) || 0) + 1);

                                    if (likesGivenByUsers.get(reaction.userId) === 3) {
                                        threeLikeGivers++;
                                    }
                                    if (likesGotByUsers.get(message.uid) === 3) {
                                        threeLikeGetters++;
                                    }
                                }
                            }
                        }

                        haveMore = batchResult.haveMore;
                        afterCursor = batchResult.cursor;
                        totalCount += batchResult.items.length;
                        await log(`Processed ${totalCount} messages`);
                    });
                }

                await log(`Sorting liked users`);
                let likedUsers: { uid: number, likesGot: number }[] = [];
                for (let [uid, likesGot] of likesGotByUsers.entries()) {
                    likedUsers.push({ uid, likesGot });
                }
                likedUsers = likedUsers.sort((a, b) => b.likesGot - a.likesGot).slice(0, 20);

                await log(`Sorting likers`);
                let likers: { uid: number, likesSent: number }[] = [];
                for (let [uid, likesSent] of likesGivenByUsers.entries()) {
                    likers.push({ uid, likesSent });
                }
                likers = likers.sort((a, b) => b.likesSent - a.likesSent).slice(0, 20);

                await inTx(parent, async ctx => {
                    let messageUsersParts: MessagePart[] = [];
                    for (let user of likers) {
                        messageUsersParts.push(boldString(`${user.likesSent}`));
                        messageUsersParts.push(` ${await Modules.Users.getUserFullName(ctx, user.uid)}\n`);
                    }

                    await Modules.Messaging.sendMessage(ctx, chatId!, botId!, buildMessage(...[
                        heading('Historic users who gave most likes'), '\n',
                        ...messageUsersParts
                    ]));
                });

                await inTx(parent, async ctx => {
                    let messageUsersParts: MessagePart[] = [];
                    for (let user of likedUsers) {
                        messageUsersParts.push(boldString(`${user.likesGot}`));
                        messageUsersParts.push(` ${await Modules.Users.getUserFullName(ctx, user.uid)}\n`);
                    }

                    await Modules.Messaging.sendMessage(ctx, chatId!, botId!, buildMessage(...[
                        heading('Historic users who got most likes'), '\n',
                        ...messageUsersParts
                    ]));
                });

                await inTx(parent, async ctx => {
                    await Modules.Messaging.sendMessage(ctx, chatId!, botId!, buildMessage(...[
                        heading(...[
                            'We have ',
                            insaneString(`${threeLikeGetters}`),
                            ' three-like getters and ',
                            insaneString(`${threeLikeGivers}`),
                            ' three-like givers'
                        ]),
                    ]));
                });

                return 'done';
            });
            return true;
        }),
    }
};
