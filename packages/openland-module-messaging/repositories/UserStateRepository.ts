import { AllEntities, UserDialogEvent } from 'openland-module-db/schema';
import { inTx } from 'foundation-orm/inTx';
import { injectable, inject } from 'inversify';
import { Context } from 'openland-utils/Context';

@injectable()
export class UserStateRepository {
    private readonly entities: AllEntities;

    constructor(@inject('FDB') entities: AllEntities) {
        this.entities = entities;
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
            let c = await this.entities.UserCounter.findById(ctx, uid);
            return await c.get(ctx) || 0;
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
                let created = await this.entities.UserDialog.create(ctx, uid, cid, { unread: 0 });
                let messagingState = await this.getUserMessagingState(ctx, uid);

                // Update chats counters
                if (!messagingState.chatsCount) {
                    messagingState.chatsCount = 1;
                } else {
                    messagingState.chatsCount++;
                }
                let chat = await this.entities.Conversation.findById(ctx, cid);
                if (chat && chat.kind === 'private') {
                    if (!messagingState.directChatsCount) {
                        messagingState.directChatsCount = 1;
                    } else {
                        messagingState.directChatsCount++;
                    }
                }
                await messagingState.flush(ctx);

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
}