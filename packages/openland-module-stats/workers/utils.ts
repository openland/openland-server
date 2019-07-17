import { Context } from '@openland/context';
import { Modules } from '../../openland-modules/Modules';
import { Store } from '../../openland-module-db/FDB';

export const getSuperNotificationsBotId = (ctx: Context) => Modules.Super.getEnvVar<number>(ctx, 'super-notifications-app-id');
export const getOnboardingReportsChatId = (ctx: Context) => Modules.Super.getEnvVar<number>(ctx, 'onboarding-reports-chat-id');
export const getEngagementReportsChatId = (ctx: Context) => Modules.Super.getEnvVar<number>(ctx, 'engagement-reports-chat-id');
export const getLeaderboardsChatId = (ctx: Context) => Modules.Super.getEnvVar<number>(ctx, 'leaderboards-chat-id');

export const getGlobalStatisticsForReport = (prefix?: string) => {
    let namePrefix = '';
    if (prefix) {
        namePrefix = prefix + '-';
    }

    return {
        userEntrances: Store.GlobalStatisticsCounters.byId(namePrefix + 'user-entrances'),
        mobileUsers: Store.GlobalStatisticsCounters.byId(namePrefix + 'mobile-users'),
        successfulInvites: Store.GlobalStatisticsCounters.byId(namePrefix + 'successful-invites'),
        messages: Store.GlobalStatisticsCounters.byId( namePrefix + 'messages'),
        senders: Store.GlobalStatisticsCounters.byId(namePrefix + 'senders'),
        inviters: Store.GlobalStatisticsCounters.byId(namePrefix + 'inviters'),
    };
};