import { Context } from '@openland/context';
import { Modules } from '../../openland-modules/Modules';
import { Store } from '../../openland-module-db/FDB';
import { MessageInput } from '../../openland-module-messaging/MessageInput';
import { boldString, buildMessage, heading, insaneString } from '../../openland-utils/MessageBuilder';
import { inTx } from '@openland/foundationdb';

export const getSuperNotificationsBotId = (ctx: Context) => Modules.Super.getEnvVar<number>(ctx, 'super-notifications-app-id');
export const getOnboardingReportsChatId = (ctx: Context) => Modules.Super.getEnvVar<number>(ctx, 'onboarding-reports-chat-id');
export const getEngagementReportsChatId = (ctx: Context) => Modules.Super.getEnvVar<number>(ctx, 'engagement-reports-chat-id');
export const getLeaderboardsChatId = (ctx: Context) => Modules.Super.getEnvVar<number>(ctx, 'leaderboards-chat-id');

export const alertIfRecord = async (
    parent: Context,
    cid: number,
    metricName: string,
    value: number,
    build: (prevRecord: number, currentRecord: number) => MessageInput,
) => {
    return await inTx(parent, async ctx => {
        let botId = await getSuperNotificationsBotId(ctx);
        if (!botId) {
            return;
        }

        let metric = await Store.StatsRecords.byId(metricName);
        let prevValue = await metric.get(ctx);
        if (value > prevValue) {
            metric.set(ctx, value);

            await Modules.Messaging.sendMessage(ctx, cid, botId, {
                ...build(prevValue, value),
            });
        }
    });
};

export const alertIfRecordDelta = async (
    parent: Context,
    cid: number,
    metricName: string,
    value: number,
    build: (prevRecord: number, currentRecord: number) => MessageInput,
) => {
    return await inTx(parent, async ctx => {
        let botId = await getSuperNotificationsBotId(ctx);
        if (!botId) {
            return;
        }

        let metric = await Store.StatsRecords.byId(metricName);
        let metricDelta = await Store.StatsRecords.byId(metricName + '-delta');

        let prevValue = await metric.get(ctx);
        let maxDelta = await metricDelta.get(ctx);

        metric.set(ctx, value);
        if ((value - prevValue) > maxDelta) {
            metricDelta.set(ctx, value - prevValue);

            await Modules.Messaging.sendMessage(ctx, cid, botId, {
                ...build(maxDelta, value - prevValue),
            });
        }
    });
};

export const buildDailyRecordAlert = (metricTitle: string) => {
    return (prevRecord: number, currentRecord: number) => buildMessage(heading(`${metricTitle} count have reached `,
        insaneString(currentRecord.toString()), ' today!',
    ), '\nPrevious record was ', boldString(prevRecord.toString()));
};

export const buildWeeklyRecordAlert = (metricTitle: string) => {
    return (prevRecord: number, currentRecord: number) => buildMessage(heading(`${metricTitle} count have reached `,
        insaneString(currentRecord.toString()), ' this week!',
    ), '\nPrevious record was ', boldString(prevRecord.toString()));
};