import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { Store } from '../openland-module-db/FDB';
import { createWeeklyEngagementReportWorker } from './workers/WeeklyEngagementReportWorker';
import { createWeeklyOnboardingReportWorker } from './workers/WeeklyOnboardingReportWorker';
import { createDailyOnboardingReportWorker } from './workers/DailyOnboardingReportWorker';
import { createDailyEngagementReportWorker } from './workers/DailyEngagementReportWorker';
import { createWeeklyUserLeaderboardWorker } from './workers/WeeklyUserLeaderboardWorker';
import { createWeeklyRoomLeaderboardWorker } from './workers/WeeklyRoomLeaderboardWorker';
import { createWeeklyRoomByMessagesLeaderboardWorker } from './workers/WeeklyRoomByMessagesLeaderboardWorker';
import { Modules } from '../openland-modules/Modules';
import { RoomProfile } from '../openland-module-db/store';
import { IDs } from 'openland-module-api/IDs';
import { resizeUcarecdnImage } from './utils';
import { createHyperlogger } from '../openland-module-hyperlog/createHyperlogEvent';
import { User } from '../openland-module-db/store';

const newMobileUserLog = createHyperlogger<{ uid: number, isTest: boolean }>('new-mobile-user');
const newSenderLog = createHyperlogger<{ uid: number, isTest: boolean }>('new-sender');
const newInvitersLog = createHyperlogger<{ uid: number, inviteeId: number, isTest: boolean }>('new-inviter');
const newAboutFillerLog = createHyperlogger<{ uid: number }>('new-about-filler');

export interface UnreadGroups {
    unreadMessagesCount: number;
    unreadMoreGroupsCount: number;
    groups: {
        previewLink: string;
        previewImage: string;
        firstTitleChar: string;
        title: string;
        unreadCount: number;
    }[];
}

@injectable()
export class StatsModule {
    public readonly weeklyEngagementQueue = createWeeklyEngagementReportWorker();
    public readonly weeklyOnboardingQueue = createWeeklyOnboardingReportWorker();
    public readonly dailyOnboardingQueue = createDailyOnboardingReportWorker();
    public readonly dailyEngagementQueue = createDailyEngagementReportWorker();
    public readonly weeklyUserLeaderboardQueue = createWeeklyUserLeaderboardWorker();
    public readonly weeklyRoomLeaderboardQueue = createWeeklyRoomLeaderboardWorker();
    public readonly weeklyRoomByMessagesLeaderboardQueue = createWeeklyRoomByMessagesLeaderboardWorker();

    start = () => {
        // no op
    }

    onNewMobileUser = async (ctx: Context, uid: number) => {
        await newMobileUserLog.event(ctx,  { uid, isTest: await Modules.Users.isTest(ctx, uid) });
    }

    onMessageSent = async (ctx: Context, uid: number) => {
        if (await Store.UserMessagesSentCounter.get(ctx, uid) === 1) {
            await newSenderLog.event(ctx, { uid, isTest: await Modules.Users.isTest(ctx, uid) });
        }
    }

    onRoomMessageSent = (ctx: Context, rid: number) => {
        Store.RoomMessagesCounter.byId(rid).increment(ctx);
    }
    
    onEmailSent = (ctx: Context, uid: number) => {
        Store.UserEmailSentCounter.byId(uid).increment(ctx);
    }

    onSuccessfulInvite = async (ctx: Context, user: User) => {
        Store.GlobalStatisticsCounters.byId('successful-invites').increment(ctx);

        let invitesCnt = await Store.UserSuccessfulInvitesCounter.byId(user.invitedBy!).get(ctx);
        if (invitesCnt === 1) {
            await newInvitersLog.event(ctx, { uid: user.invitedBy!, inviteeId: user.id, isTest: await Modules.Users.isTest(ctx, user.invitedBy!) });
        }
    }

    onAboutChange = async (ctx: Context, uid: number) => {
        if (!await Store.UserHasFilledAbout.byId(uid).get(ctx)) {
            Store.UserHasFilledAbout.byId(uid).set(ctx, true);
            await newAboutFillerLog.event(ctx, { uid });
        }
    }

    getUnreadGroupsByUserId = async (ctx: Context, uid: number, first: number): Promise<UnreadGroups> => {
        const dialogs = await Store.UserDialog.user.findAll(ctx, uid);
        const unreadMessagesCount = await Store.UserCounter.byId(uid).get(ctx);
        const withUnreadCount = await Promise.all(
            dialogs.map(async dialog => {
                const unreadCount = await Store.UserDialogCounter.byId(uid, dialog.cid).get(ctx);
                const roomProfile = await Store.RoomProfile.findById(ctx, dialog.cid);

                if (!roomProfile) {
                    return null;
                }

                const serializedId = IDs.Conversation.serialize(dialog.cid);

                const croppedX2PreviewImage =
                    roomProfile.socialImage && resizeUcarecdnImage(roomProfile.socialImage, { height: 80, width: 80 });

                // TODO: map photo to absent photo by hash (likewise on client)

                return {
                    previewLink: `https://openland.com/mail/${serializedId}`,
                    previewImage: croppedX2PreviewImage ? croppedX2PreviewImage : 'https://i.imgur.com/Y1SwoOJ.png',
                    // if no preview image, used as indicator of group by first char of title
                    firstTitleChar: roomProfile.title ? roomProfile.title[0].toUpperCase() : '',
                    title: roomProfile.title,
                    unreadCount,
                };
            }),
        );

        // DESC
        const sortedByUnreadCount = withUnreadCount
            .filter(u => u && u.unreadCount > 0)
            .sort((a, b) => b!.unreadCount - a!.unreadCount) as NonNullable<typeof withUnreadCount[0]>[];

        const firstN = sortedByUnreadCount.slice(0, first);

        const unreadMoreGroupsCount = Math.max(sortedByUnreadCount.length - firstN.length, 0);

        return {
            unreadMessagesCount,
            unreadMoreGroupsCount,
            groups: firstN,
        };
    }

    getTrendingRoomsByMessages = async (ctx: Context, from: number, to: number, size?: number) => {
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

        let roomsWithDelta: { room: RoomProfile; messagesDelta: number }[] = [];
        for (let bucket of searchReq.aggregations.byCid.buckets) {
            let rid = bucket.key;
            let room = await Store.RoomProfile.findById(ctx, rid);

            let conv = await Store.ConversationRoom.findById(ctx, rid);

            if (!room || !conv || !conv.oid) {
                continue;
            }

            let org = await Store.Organization.findById(ctx, conv.oid);
            let isListed = conv!.kind === 'public' && org && org.kind === 'community' && !org.private;
            if (!isListed || conv.isChannel) {
                continue;
            }

            roomsWithDelta.push({
                room: room,
                messagesDelta: bucket.doc_count,
            });
            if (roomsWithDelta.length === size) {
                break;
            }
        }

        return roomsWithDelta;
    }
}
