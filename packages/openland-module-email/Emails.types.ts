import { FormatedUnreadGroups, FormatedTrendGroups } from 'openland-module-stats/StatsModule.types';

export const DIGEST_FIRST_UNREAD_GROUPS = 4;
export const DIGEST_FIRST_TREND_GROUPS = 6;

export type WeeklyDigestEmailArgs = {
  unreadMessages: FormatedUnreadGroups
  trendingGroups: FormatedTrendGroups
};