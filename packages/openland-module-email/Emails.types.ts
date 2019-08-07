import { FormatedUnreadGroups, FormatedTrendGroups, FormatedTopPosts } from 'openland-module-stats/StatsModule.types';

export const DIGEST_FIRST_UNREAD_GROUPS = 5;
export const DIGEST_FIRST_TREND_GROUPS = 6;

export type WeeklyDigestTemplateData = {
  subject: string;
  title: string;
  topPosts: FormatedTopPosts
  unreadMessages: FormatedUnreadGroups
  trendingGroups: FormatedTrendGroups
};