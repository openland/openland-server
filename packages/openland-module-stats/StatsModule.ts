import { Events } from 'openland-module-hyperlog/Events';
import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { Store } from '../openland-module-db/FDB';
import { Modules } from '../openland-modules/Modules';
import { Message, RoomProfile } from '../openland-module-db/store';
import { IDs } from 'openland-module-api/IDs';
import { UnreadGroups, TrendGroup, TrendGroups, UnreadGroup, GroupedByConvKind, TopPost } from './StatsModule.types';
import { User } from '../openland-module-db/store';
import { groupBy } from 'openland-utils/groupBy';
import { buildBaseImageUrl } from 'openland-module-media/ImageRef';
import { EmailSpan } from 'openland-module-email/EmailSpans';

@injectable()
export class StatsModule {
    // public readonly weeklyEngagementQueue = createWeeklyEngagementReportWorker();
    // public readonly weeklyOnboardingQueue = createWeeklyOnboardingReportWorker();
    // public readonly dailyOnboardingQueue = createDailyOnboardingReportWorker();
    // public readonly dailyEngagementQueue = createDailyEngagementReportWorker();
    // public readonly weeklyUserLeaderboardQueue = createWeeklyUserLeaderboardWorker();
    // public readonly weeklyRoomLeaderboardQueue = createWeeklyRoomLeaderboardWorker();
    // public readonly weeklyRoomByMessagesLeaderboardQueue = createWeeklyRoomByMessagesLeaderboardWorker();
    // public readonly dailyPaidLeaderboardQueue = createDailyPaidLeaderboardWorker();
    // public readonly weeklyPaidLeaderboardQueue = createWeeklyPaidLeaderboardWorker();
    // public readonly weeklyRoomViewsQueue = createWeeklyRoomScreenViewsLeaderboardWorker();

    start = async () => {
        // no op
    }

    onNewMobileUser = async (ctx: Context, uid: number) => {
        Events.StatsNewMobileUserLog.event(ctx, { uid, isTest: await Modules.Users.isTest(ctx, uid) });
    }

    onMessageSent = async (ctx: Context, uid: number) => {
        if (await Store.UserMessagesSentCounter.get(ctx, uid) === 1) {
            Events.StatsNewSenderLog.event(ctx, { uid, isTest: await Modules.Users.isTest(ctx, uid) });
        }
    }

    onRoomMessageSent = async (ctx: Context, rid: number) => {
        Store.RoomMessagesCounter.byId(rid).increment(ctx);
        let conv = await Store.ConversationRoom.findById(ctx, rid);
        if (conv) {
            await Modules.Messaging.room.markChatForIndexing(ctx, rid);
        }
    }

    onEmailSent = (ctx: Context, uid: number) => {
        Store.UserEmailSentCounter.byId(uid).increment(ctx);
    }

    onSuccessfulInvite = async (ctx: Context, user: User) => {
        Store.GlobalStatisticsCounters.byId('successful-invites').increment(ctx);

        let invitesCnt = await Store.UserSuccessfulInvitesCounter.byId(user.invitedBy!).get(ctx);
        if (invitesCnt === 1) {
            Events.StatsNewInvitersLog.event(ctx, { uid: user.invitedBy!, inviteeId: user.id, isTest: await Modules.Users.isTest(ctx, user.invitedBy!) });
        }
    }

    onAboutChange = async (ctx: Context, uid: number) => {
        if (!await Store.UserHasFilledAbout.byId(uid).get(ctx)) {
            Store.UserHasFilledAbout.byId(uid).set(ctx, true);
            Events.StatsNewAboutFillerLog.event(ctx, { uid, isTest: await Modules.Users.isTest(ctx, uid) });
        }
    }

    onReactionSet = async (ctx: Context, message: Message, uid: number) => {
        Store.UserReactionsGot.byId(message.uid).increment(ctx);
        Store.UserReactionsGiven.byId(uid).increment(ctx);

        Events.StatsNewReactionLog.event(ctx, {
            uid,
            messageAuthorId: message.uid,
            mid: message.id,
            isTest: await Modules.Users.isTest(ctx, uid)
        });

        if (await Store.UserReactionsGiven.byId(uid).get(ctx) === 3) {
            Events.StatsNewThreeLikeGiverLog.event(ctx, {
                uid,
                isTest: await Modules.Users.isTest(ctx, uid)
            });
        }
        if (await Store.UserReactionsGot.byId(message.uid).get(ctx) === 3) {
            Events.StatsNewThreeLikeGetterLog.event(ctx, {
                uid: message.uid,
                isTest: await Modules.Users.isTest(ctx, uid)
            });
        }
    }

    getTopPosts = async (ctx: Context, uid: number, cid: number) => {
        const firstThree = (await Store.Message.chat.query(ctx, cid, { limit: 3, reverse: true })).items;
        const top = firstThree.find(message => !message.isService);

        if (!top) {
            return [];
        }

        const userId = top.uid;
        const userProfile = (await (Store.UserProfile.findById(ctx, userId)))!;

        const org = userProfile.primaryOrganization
            ? await Store.OrganizationProfile.findById(ctx, userProfile.primaryOrganization)
            : null;

        if (!org) {
            return [];
        }

        const spans = await Promise.all((top.spans || []).map(async span => {
            if (span.type === 'all_mention' || span.type === 'user_mention') {
                const actualId = span.type === 'all_mention' ? uid : span.user;
                const user = (await (Store.UserProfile.findById(ctx, actualId)))!;
                return {
                    type: 'user_mention',
                    length: span.length,
                    offset: span.offset,
                    user: {
                        id: IDs.User.serialize(user.id),
                        name: [user.firstName, user.lastName].filter((v) => v).join(' ')
                    }
                } as EmailSpan;
            } else {
                return {
                    ...span
                } as EmailSpan;
            }
        }));

        const topPost = {
            message: top.text,
            spans,
            sender: {
                id: IDs.User.serialize(userProfile.id),
                avatar: userProfile.picture ? buildBaseImageUrl(userProfile.picture) : '',
                name: [userProfile.firstName, userProfile.lastName].filter((v) => v).join(' '),

                orgId: IDs.Organization.serialize(org.id),
                orgName: org.name,
            },
            chatId: IDs.Conversation.serialize(cid),
            likesCount: (top.reactions || []).length,
            commentsCount: (top.replyMessages || []).length
        } as TopPost;

        return [topPost];
    }

    getUnreadGroupsByUserId = async (ctx: Context, uid: number, first: number): Promise<UnreadGroups> => {
        const dialogs = await Modules.Messaging.findUserDialogs(ctx, uid);
        const unreadMessagesCount = Math.max(await Store.UserCounter.byId(uid).get(ctx), 0);
        const withUnreadCount = await Promise.all(
            dialogs.map(async dialog => {
                const unreadCount = await Modules.Messaging.fetchUserUnreadInChat(ctx, uid, dialog.cid);
                const conv = (await Store.Conversation.findById(ctx, dialog.cid));

                if (!conv) {
                    return null;
                }

                let previewImage = '';
                let title = '';
                try {
                    previewImage = await Modules.Messaging.room.resolveConversationPhoto(ctx, dialog.cid, uid) || '';
                } catch (e) {
                    // ignore
                }
                try {
                    title = await Modules.Messaging.room.resolveConversationTitle(ctx, dialog.cid, uid) || '';
                } catch (e) {
                    // ignore
                }

                const serializedId = IDs.Conversation.serialize(dialog.cid);

                return {
                    serializedId,
                    previewImage: previewImage.includes('https') ? previewImage : '',
                    title,
                    unreadCount,
                    convKind: conv.kind
                };
            }),
        );

        // DESC
        const sortedByUnreadCount = withUnreadCount
            .filter(u => u && u.unreadCount > 0)
            .sort((a, b) => b!.unreadCount - a!.unreadCount) as NonNullable<UnreadGroup>[];

        const firstN = sortedByUnreadCount.slice(0, first);

        const unreadMoreGroupsCount = Math.max(sortedByUnreadCount.length - firstN.length, 0);

        const groupedByConvKind = groupBy(firstN, group => group.convKind) as GroupedByConvKind;

        // add at least 2 personal chats at beginning of groups (by spec)
        const firstTwoPersonalChats = (groupedByConvKind.private || []).slice(0, 2);
        const orgAndRoomChats = [
            ...(groupedByConvKind.organization || []),
            ...(groupedByConvKind.room || [])
        ].sort((a, b) => b!.unreadCount - a!.unreadCount);

        return {
            unreadMessagesCount,
            unreadMoreGroupsCount,
            groups: [...firstTwoPersonalChats, ...orgAndRoomChats],
        };
    }

    getTrendingGroupsByMessages = async (ctx: Context, from: number, to: number, first: number): Promise<TrendGroups> => {
        const tredings = await this.getTrendingRoomsByMessages(ctx, from, to, first);
        const withMessagesDelta = await Promise.all(tredings.map(async trend => {
            const { room } = trend;

            let previewImage = '';
            try {
                previewImage = await Modules.Messaging.room.resolveConversationPhoto(ctx, room.id, 0) || '';
            } catch (e) {
                // ignore
            }

            // const membersCount = await Modules.Messaging.roomMembersCount(ctx, room.id);
            const serializedId = IDs.Conversation.serialize(room.id);

            return {
                serializedId,
                previewImage: previewImage.includes('https') ? previewImage : '',
                title: room.title,
                messagesDelta: trend.messagesDelta
                // membersCount
            } as TrendGroup;
        }));

        return {
            groups: withMessagesDelta
        };
    }

    getTrendingRoomsByMessages = async (ctx: Context, from: number, to: number, size?: number, after?: number) => {
        let searchReq = await Modules.Search.elastic.client.search({
            index: 'message',
            type: 'message', // scroll: '1m',
            body: {
                query: {
                    bool: {
                        must: [
                            { term: { roomKind: 'room' } },
                            { term: { isService: false } },
                            {
                                range: {
                                    createdAt: {
                                        gte: from,
                                        lte: to,
                                    },
                                },
                            },
                        ],
                    },
                },
                aggs: {
                    byCid: {
                        terms: {
                            field: 'cid',
                            size: Math.pow(10, 9),
                            order: { _count: 'desc' },
                        },
                    },
                },
            },
            size: 0,
        });

        let roomsWithDelta: { room: RoomProfile; messagesDelta: number, cursor: number }[] = [];
        let cursor = after || 0;
        for (let bucket of searchReq.aggregations.byCid.buckets.slice(cursor)) {
            cursor++;
            let rid = bucket.key;
            let room = await Store.RoomProfile.findById(ctx, rid);

            let conv = await Store.ConversationRoom.findById(ctx, rid);

            if (!room || !conv || !conv.oid) {
                continue;
            }

            let org = await Store.Organization.findById(ctx, conv.oid);

            let isListed = conv!.kind === 'public' && org && org.kind === 'community' && !org.private && conv.listed;
            if (!(isListed) || conv.isChannel) {
                continue;
            }

            roomsWithDelta.push({
                room: room,
                messagesDelta: bucket.doc_count,
                cursor: cursor,
            });
            if (roomsWithDelta.length === size) {
                break;
            }
        }

        return roomsWithDelta;
    }

    getGroupScreenViewsByPeriod = async (ctx: Context, cid: number, from?: Date | null, to?: Date | null) => {
        let encryptedId = IDs.Conversation.serialize(cid);
        let terms: any = [
            { term: { type: 'track' } },
            { term: { ['body.isProd']: true } },
            { term: { ['body.name']: 'invite_landing_view' } },
            { term: { ['body.args.invite_type']: 'group' } },
            { match: { ['body.args.entity_id']: { query: encryptedId } } },
        ];

        let dateTerm: any = {};
        if (from) {
            dateTerm.gte = from.getTime();
        }
        if (to) {
            dateTerm.lte = to.getTime();
        }
        if (dateTerm.gte || dateTerm.lte) {
            terms.push({
                range: {
                    ['body.time']: dateTerm
                }
            });
        }
        let request = await Modules.Search.elastic.client.search({
            index: 'hyperlog', type: 'hyperlog',
            size: 0,
            body: {
                query: {
                    bool: {
                        must: terms,
                    }
                }
            }
        });

        return (request.hits.total as any).value;
    }
}
