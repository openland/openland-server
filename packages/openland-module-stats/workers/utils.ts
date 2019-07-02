import { Context } from '@openland/context';
import { Modules } from '../../openland-modules/Modules';
import { Store } from '../../openland-module-db/FDB';

export const getSuperNotificationsBotId = (ctx: Context) => Modules.Super.getEnvVar<number>(ctx, 'super-notifications-app-id');
export const getUserReportsChatId = (ctx: Context) => Modules.Super.getEnvVar<number>(ctx, 'super-reports-chat-id');
export const getGrowthReportsChatId = (ctx: Context) => Modules.Super.getEnvVar<number>(ctx, 'growth-reports-chat-id');

export const getGlobalStatisticsForReport = (prefix?: string) => {
    let namePrefix = '';
    if (prefix) {
        namePrefix = prefix + '-';
    }

    return {
        userEntrances: Store.GlobalStatisticsCounters.byId(namePrefix + 'user-entrances'),
        mobileUsers: Store.GlobalStatisticsCounters.byId(namePrefix + 'mobile-users'),
        successfulInvites: Store.GlobalStatisticsCounters.byId(namePrefix + 'successful-invites')
    };
};

export const resolveUsername = (firstName: string, lastName: string | null) => {
    if (lastName) {
        return firstName + ' ' + lastName;
    } else {
        return firstName;
    }
};