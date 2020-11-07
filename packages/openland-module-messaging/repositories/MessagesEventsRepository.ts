import { inTx } from '@openland/foundationdb';
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

    async postMessageUpdatedByMid(parent: Context, mid: number) {
        await inTx(parent, async (ctx) => {
            let message = await Store.Message.findById(ctx, mid);
            if (!message) {
                throw new Error('Message not found');
            }
            Store.ConversationEventStore.post(ctx, message!.cid, MessageUpdatedEvent.create({
                cid: message!.cid,
                mid,
                hiddenForUids: message.hiddenForUids || []
            }));
        });
    }
}