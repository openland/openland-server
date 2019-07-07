import { inTx } from '@openland/foundationdb';
import { AllEntities, UserDialogEvent } from 'openland-module-db/schema';
import { injectable, inject } from 'inversify';
import { Context } from '@openland/context';
import { ChatMetricsRepository } from './ChatMetricsRepository';
import { Store } from 'openland-module-db/FDB';

@injectable()
export class UserStateRepository {
    private readonly entities: AllEntities;
    private readonly metrics: ChatMetricsRepository;

    constructor(@inject('FDB') entities: AllEntities, @inject('ChatMetricsRepository') metrics: ChatMetricsRepository) {
        this.entities = entities;
        this.metrics = metrics;
    }

    async getRoomSettings(parent: Context, uid: number, cid: number) {
        return await inTx(parent, async (ctx) => {
            let res = await this.entities.UserDialogSettings.findById(ctx, uid, cid);
            if (res) {
                return res;
            }
            return await this.entities.UserDialogSettings.create(ctx, uid, cid, { mute: false });
        });
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
            let existing = await this.entities.UserNotificationsState.findById(ctx, uid);
            if (!existing) {
                let created = await this.entities.UserNotificationsState.create(ctx, uid, {});
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
            let existing = await this.entities.UserMessagingState.findById(ctx, uid);
            if (!existing) {
                let created = await this.entities.UserMessagingState.create(ctx, uid, {
                    seq: 0,
                    unread: 0,
                    messagesReceived: 0,
                    messagesSent: 0,
                    chatsCount: 0,
                    directChatsCount: 0
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
            let existing = await this.entities.UserDialog.findById(ctx, uid, cid);
            if (!existing) {

                // Update chats counters
                let chat = await this.entities.Conversation.findById(ctx, cid);
                if (chat && chat.kind === 'private') {
                    this.metrics.onDirectChatCreated(ctx, uid);
                }

                let created = await this.entities.UserDialog.create(ctx, uid, cid, { unread: 0 });
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
            let res = await this.entities.UserDialogEvent.rangeFromUserWithCursor(parent, uid, 1000, cursor);
            cursor = res.cursor;
            if (res.items.length && res.cursor) {
                yield { items: this.zipUserDialogEvents(res.items), cursor: res.cursor, fromSeq: res.items[0].seq };
            }
            loadMore = res.haveMore;
        }
        return;
    }

    async fetchUserGlobalCounter(parent: Context, uid: number) {
        return await inTx(parent, async (ctx) => {
            let settings = await Store.UserSettings.findById(ctx, uid);
            if (!settings) {
                return await Store.UserGlobalCounterAllUnreadMessages.get(ctx, uid);
            }

            if (settings.globalCounterType === 'unread_messages') {
                return await Store.UserGlobalCounterAllUnreadMessages.get(ctx, uid);
            } else if (settings.globalCounterType === 'unread_chats') {
                return await Store.UserGlobalCounterAllUnreadChats.get(ctx, uid);
            } else if (settings.globalCounterType === 'unread_messages_no_muted') {
                return await Store.UserGlobalCounterUnreadMessagesWithoutMuted.get(ctx, uid);
            } else if (settings.globalCounterType === 'unread_chats_no_muted') {
                return await Store.UserGlobalCounterUnreadChatsWithoutMuted.get(ctx, uid);
            } else {
                return await Store.UserGlobalCounterAllUnreadMessages.get(ctx, uid);
            }
        });
    }

}