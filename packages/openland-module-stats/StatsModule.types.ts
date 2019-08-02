
interface StatsGroup {
  serializedId: string;
  previewImage: string;
  title: string;
}

type FormatProps = { subTitle: string, color: string, previewLink: string, firstTitleChar: string; };

// ----

export type UnreadGroup = StatsGroup & { unreadCount: number; };

export interface UnreadGroups {
  unreadMessagesCount: number;
  unreadMoreGroupsCount: number;
  groups: UnreadGroup[];
}

export type FormatedUnreadGroup = UnreadGroup & FormatProps;

export interface FormatedUnreadGroups {
  unreadMessagesCount: number;
  unreadMoreGroupsCount: number;
  rows: {
    items: FormatedUnreadGroup[]
  }[];
}

// ----

export type TrendGroup = StatsGroup & { membersCount: number; };

export interface TrendGroups {
  groups: TrendGroup[];
}

export type FormatedTrendGroup = TrendGroup & FormatProps;

export interface FormatedTrendGroups {
  rows: {
    items: FormatedTrendGroup[]
  }[];
}
