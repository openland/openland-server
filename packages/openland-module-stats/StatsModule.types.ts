
import { HandlebarsMessageSpan, EmailSpan } from 'openland-module-email/EmailSpans';

interface StatsGroup {
  serializedId: string;
  previewImage: string;
  title: string;
}

type FormatProps = { subTitle: string, color: string, previewLink: string, firstTitleChar: string; };

export type ConvKind = 'organization' | 'room' | 'private';

// ----

export type UnreadGroup = StatsGroup & { unreadCount: number; convKind: ConvKind };

export type GroupedByConvKind = { [key in ConvKind]: UnreadGroup[] | undefined };

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

export type TrendGroup = StatsGroup & {
  messagesDelta: number
  //  membersCount: number;
};

export interface TrendGroups {
  groups: TrendGroup[];
}

export type FormatedTrendGroup = TrendGroup & FormatProps;

export interface FormatedTrendGroups {
  rows: {
    items: FormatedTrendGroup[]
  }[];
}

// ----

// type A = typeof Message

export interface TopPost {
  message: string;
  spans: EmailSpan[];
  sender: {
    id: string;
    name: string
    avatar: string;

    orgId: string;
    orgName: string;
  };
  chatId: string;
  likesCount: number;
  commentsCount: number;
}

export type FormatedTopPost = TopPost & {
  spans: HandlebarsMessageSpan[]
  sender: {
    orgLink: string,
    profileLink: string;
  }
  chatLink: string;
};

export interface FormatedTopPosts {
  items: FormatedTopPost[];
}
