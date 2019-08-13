import { UserDialogEvent } from 'openland-module-db/store';
import { encoders, inTx } from '@openland/foundationdb';
import { injectable, inject } from 'inversify';
import { Context } from '@openland/context';
import { ChatMetricsRepository } from './ChatMetricsRepository';
import { Store } from 'openland-module-db/FDB';

@injectable()
export class UserStateRepository {
    private readonly metrics: ChatMetricsRepository;

    constructor(@inject('ChatMetricsRepository') metrics: ChatMetricsRepository) {
        this.metrics = metrics;
    }

    async getRoomSettings(parent: Context, uid: number, cid: number) {
        return await inTx(parent, async (ctx) => {
            let res = await Store.UserDialogSettings.findById(ctx, uid, cid);
            if (res) {
                return res;
            }
            return await Store.UserDialogSettings.create(ctx, uid, cid, { mute: false });
        });
    }

    async isChatMuted(ctx: Context, uid: number, cid: number) {
        let res = await Store.UserDialogSettings.findById(ctx, uid, cid);
        if (!res) {
            return false;
        }
        return res.mute;
    }

    async markAsSeqRead(parent: Context, uid: number, toSeq: number) {
        await inTx(parent, async (ctx) => {
            let state = await this.getUserNotificationState(ctx, uid);
            let global = await this.getUserMessagingState(ctx, uid);
            if (toSeq > global.seq) {
                state.readSeq = global.seq;
            } else {
                state.readSeq = toSeq;
            }
            await state.flush(ctx);
        });
    }

    async getUserNotificationState(parent: Context, uid: number) {
        return await inTx(parent, async (ctx) => {
            let existing = await Store.UserNotificationsState.findById(ctx, uid);
            if (!existing) {
                let created = await Store.UserNotificationsState.create(ctx, uid, {});
                await created.flush(ctx);
                return created;
            } else {
                return existing;
            }
        });
    }

    async getUserMessagingUnread(parent: Context, uid: number) {
        return await inTx(parent, async (ctx) => {
            return await Store.UserCounter.byId(uid).get(ctx);
        });
    }

    async getUserMessagingDialogUnread(parent: Context, uid: number, cid: number) {
        return await inTx(parent, async (ctx) => {
            return await Store.UserDialogCounter.byId(uid, cid).get(ctx);
        });
    }

    async getUserMessagingState(parent: Context, uid: number) {
        return await inTx(parent, async (ctx) => {
            let existing = await Store.UserMessagingState.findById(ctx, uid);
            if (!existing) {
                let created = await Store.UserMessagingState.create(ctx, uid, {
                    seq: 0
                });
                await created.flush(ctx);
                return created;
            } else {
                return existing;
            }
        });
    }

    async getUserDialogState(parent: Context, uid: number, cid: number) {
        return await inTx(parent, async (ctx) => {
            let existing = await Store.UserDialog.findById(ctx, uid, cid);
            if (!existing) {

                // Update chats counters
                let chat = await Store.Conversation.findById(ctx, cid);
                if (chat && chat.kind === 'private') {
                    this.metrics.onDirectChatCreated(ctx, uid);
                }

                let created = await Store.UserDialog.create(ctx, uid, cid, { unread: 0 });
                await created.flush(ctx);
                return created;
            } else {
                return existing;
            }
        });
    }

    zipUserDialogEvents = (events: UserDialogEvent[]) => {
        let zipedEvents = [];
        let latestChatsUpdatesByType = new Map<string, UserDialogEvent>();
        let currentEvent: UserDialogEvent;
        let currentEventKey: string;
        for (let i = events.length - 1; i >= 0; i--) {
            currentEvent = events[i];
            currentEventKey = currentEvent.cid + '_' + currentEvent.kind;
            if (!latestChatsUpdatesByType.get(currentEventKey)) {
                zipedEvents.unshift(currentEvent);
                latestChatsUpdatesByType.set(currentEventKey, currentEvent);
            }
        }
        return zipedEvents;
    }

    async *zipUpdatesInBatchesAfter(parent: Context, uid: number, state: string | undefined) {
        let cursor = state;
        let loadMore = !!cursor;
        while (loadMore) {
            let res = await Store.UserDialogEvent.user.query(parent, uid, { limit: 1000, afterCursor: cursor });
            cursor = res.cursor;
            if (res.items.length && res.cursor) {
                yield { items: this.zipUserDialogEvents(res.items), cursor: res.cursor, fromSeq: res.items[0].seq };
            }
            loadMore = res.haveMore;
        }
        return;
    }

    async fetchUserGlobalCounter(ctx: Context, uid: number) {
        let settings = await Store.UserSettings.findById(ctx, uid);
        if (!settings) {
            return await Store.UserGlobalCounterAllUnreadMessages.get(ctx, uid);
        }

        let directory = Store.UserCountersIndexDirectory
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.int32LE);

        if (settings.globalCounterType === 'unread_messages') {
            let all = await directory.range(ctx, [uid]);
            return all.reduce((acc, val) => acc + val.value as number, 0);
        } else if (settings.globalCounterType === 'unread_chats') {
            return (await directory.range(ctx, [uid])).length;
        } else if (settings.globalCounterType === 'unread_messages_no_muted') {
            let unread = await directory.range(ctx, [uid, 'unmuted']);
            return unread.reduce((acc, val) => acc + val.value as number, 0);
        } else if (settings.globalCounterType === 'unread_chats_no_muted') {
            return (await directory.range(ctx, [uid, 'unmuted'])).length;
        } else {
            let all = await directory.range(ctx, [uid]);
            return all.reduce((acc, val) => acc + val.value as number, 0);
        }
    }

}