import { Context } from '@openland/context';
import { MessageReceivedEvent, MessageUpdatedEvent, MessageDeletedEvent } from 'openland-module-db/store';
import { Store } from 'openland-module-db/FDB';
import { injectable } from 'inversify';

@injectable()
export class MessagesEventsRepository {

    postMessageReceived(ctx: Context, cid: number, mid: number, hiddenForUids: number[]) {
        Store.ConversationEventStore.post(ctx, cid, MessageReceivedEvent.create({
            cid,
            mid,
            hiddenForUids
        }));
    }

    postMessageUpdated(ctx: Context, cid: number, mid: number, hiddenForUids: number[]) {
        Store.ConversationEventStore.post(ctx, cid, MessageUpdatedEvent.create({
            cid,
            mid,
            hiddenForUids
        }));
    }

    postMessageDeleted(ctx: Context, cid: number, mid: number, hiddenForUids: number[]) {
        Store.ConversationEventStore.post(ctx, cid, MessageDeletedEvent.create({
            cid,
            mid,
            hiddenForUids
        }));
    }
}