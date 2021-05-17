import { UserDialogBumpEvent, UserDialogCallStateChangedEvent, UserDialogEvent, UserDialogGotAccessEvent, UserDialogLostAccessEvent, UserDialogMessageReadEvent, UserDialogMessageReceivedEvent, UserDialogMessageUpdatedEvent, UserDialogMuteChangedEvent, UserDialogPeerUpdatedEvent, UserDialogPhotoUpdatedEvent, UserDialogTitleUpdatedEvent, UserDialogVoiceChatStateChangedEvent } from 'openland-module-db/store';
import { encoders, inTx, Subspace, TupleItem } from '@openland/foundationdb';
import { injectable, inject } from 'inversify';
import { Context } from '@openland/context';
import { ChatMetricsRepository } from './ChatMetricsRepository';
import { Store } from 'openland-module-db/FDB';
import { BaseEvent } from '@openland/foundationdb-entity';

@injectable()
export class UserStateRepository {
    private readonly metrics: ChatMetricsRepository;
    private readonly muteDirectory: Subspace<TupleItem[], boolean>;

    constructor(@inject('ChatMetricsRepository') metrics: ChatMetricsRepository) {
        this.metrics = metrics;

        this.muteDirectory = Store.UserDialogMuteSettingDirectory
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.boolean);
    }

    async getRoomSettings(parent: Context, uid: number, cid: number) {
        let res = await Store.UserDialogSettings.findById(parent, uid, cid);
        if (res) {
            return { cid, mute: res.mute };
        }
        return { cid, mute: false };
    }

    async isChatMuted(ctx: Context, uid: number, cid: number) {
        let res = await Store.UserDialogSettings.findById(ctx, uid, cid);
        if (!res) {
            return false;
        }
        return res.mute;
    }

    async setChatMuted(parent: Context, uid: number, cid: number, mute: boolean) {
        return await inTx(parent, async ctx => {
            if (mute) {
                this.muteDirectory.set(ctx, [uid, cid], true);
            } else {
                this.muteDirectory.clear(ctx, [uid, cid]);
            }

            // Update old settings
            let res = await Store.UserDialogSettings.findById(parent, uid, cid);
            if (res) {
                res.mute = mute;
            } else {
                await Store.UserDialogSettings.create(ctx, uid, cid, { mute });
            }
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

    calculateDialogOldEventKey = (src: UserDialogEvent) => {
        switch (src.kind) {
            case 'dialog_bump':
            case 'dialog_deleted':
            case 'dialog_mentioned_changed':
            case 'dialog_mute_changed':
            case 'photo_updated':
            case 'title_updated':
            case 'message_read':
            case 'message_received':
                if (src.cid === null /* Wtf? */) {
                    return null;
                }
                return 'dialog$' + src.kind + '-' + src.cid;
            case 'message_deleted':
                if (src.mid === null/* Wtf? */) {
                    return null;
                }
                return 'message$deleted' + src.mid;
            case 'message_updated':
                if (src.mid === null/* Wtf? */) {
                    return null;
                }
                return 'message$updated' + src.mid;
            default:
                return null;
        }
    }

    calculateDialogEventKey = (src: BaseEvent) => {

        //
        // Messages
        //

        if (src instanceof UserDialogMessageReceivedEvent) {
            return 'dialog$received$' + src.cid;
        }
        if (src instanceof UserDialogMessageUpdatedEvent) {
            return 'message$updated$' + src.mid;
        }
        if (src instanceof UserDialogMessageReadEvent) {
            return 'dialog$read$' + src.cid;
        }
        if (src instanceof UserDialogBumpEvent) {
            return 'dialog$bump$' + src.cid;
        }

        //
        // Dialogs
        //

        if (src instanceof UserDialogTitleUpdatedEvent) {
            return 'dialog$title$' + src.cid;
        }
        if (src instanceof UserDialogPhotoUpdatedEvent) {
            return 'dialog$photo$' + src.cid;
        }
        if (src instanceof UserDialogPeerUpdatedEvent) {
            return 'dialog$peer$' + src.cid;
        }
        if (src instanceof UserDialogGotAccessEvent) {
            return 'dialog$access$' + src.cid;
        }
        if (src instanceof UserDialogLostAccessEvent) {
            return 'dialog$access$' + src.cid;
        }
        if (src instanceof UserDialogMuteChangedEvent) {
            return 'dialog$mute$' + src.cid;
        }
        if (src instanceof UserDialogCallStateChangedEvent) {
            return 'dialog$calls$' + src.cid;
        }
        if (src instanceof UserDialogVoiceChatStateChangedEvent) {
            return 'dialog$voice$' + src.cid;
        }

        return null;
    }

    zipUserDialogEventsModern(events: BaseEvent[]): BaseEvent[] {
        let zipedEvents: BaseEvent[] = [];
        let latestChatsUpdatesByType = new Map<string, BaseEvent>();

        for (let i = events.length - 1; i >= 0; i--) {
            const currentEvent = events[i];
            const currentEventKey = this.calculateDialogEventKey(currentEvent);
            if (currentEventKey !== null) {
                if (!latestChatsUpdatesByType.get(currentEventKey)) {
                    zipedEvents.unshift(currentEvent);
                    latestChatsUpdatesByType.set(currentEventKey, currentEvent);
                }
            } else {
                zipedEvents.unshift(currentEvent);
            }
        }
        return zipedEvents;
    }

    async* zipUpdatesInBatchesAfterModern(parent: Context, uid: number, state: string | undefined) {
        if (!state) {
            return;
        }
        let stream = Store.UserDialogEventStore.createStream(uid, { batchSize: 100, after: state });
        while (true) {
            let res = await stream.next(parent);
            if (res.length > 0) {
                yield { items: this.zipUserDialogEventsModern(res), cursor: stream.cursor };
            } else {
                return;
            }
        }
    }
}
