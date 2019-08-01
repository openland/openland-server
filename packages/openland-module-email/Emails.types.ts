import { FormatedUnreadGroups, FormatedTrendGroups } from 'openland-module-stats/StatsModule.types';

export const DIGEST_FIRST_UNREAD_GROUPS = 3;
export const DIGEST_FIRST_TREND_GROUPS = 6;

export type WeeklyDigestTemplateData = {
  unreadMessages: FormatedUnreadGroups
  trendingGroups: FormatedTrendGroups
};