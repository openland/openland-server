import { Context } from '@openland/context';

export interface CounterProvider {
    fetchUserGlobalCounter(parent: Context, uid: number): Promise<number>;

    fetchUserUnreadMessagesCount(parent: Context, uid: number): Promise<number>;

    fetchUserCounters(parent: Context, uid: number): Promise<{cid: number, unreadCounter: number, haveMention: boolean}[]>;

    fetchUserCountersForChats(ctx: Context, uid: number, cids: number[], includeAllMention: boolean): Promise<{cid: number, unreadCounter: number, haveMention: boolean}[]>;

    fetchUserUnreadInChat(ctx: Context, uid: number, cid: number): Promise<number>;

    fetchUserMentionedInChat(ctx: Context, uid: number, cid: number): Promise<boolean>;
}