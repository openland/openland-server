import { injectable } from 'inversify';
import { Context } from '@openland/context';
import {
    FeedEvent, UpdateFeedItemDeleted, UpdateFeedItemReceived, UpdateFeedItemUpdated
} from '../../openland-module-db/store';
import { Modules } from '../../openland-modules/Modules';

@injectable()
export class FeedDeliveryMediator {

    start = () => {
        // noop
    }

    onNewItem = async (root: Context, item: FeedEvent) => {
        let event = UpdateFeedItemReceived.create({ tid: item.tid, itemId: item.id });
        await Modules.Events.postToFeedTopic(root, item.tid, event);
    }

    onItemUpdated = async (root: Context, item: FeedEvent) => {
        let event = UpdateFeedItemUpdated.create({ tid: item.tid, itemId: item.id });
        await Modules.Events.postToFeedTopic(root, item.tid, event);
    }

    onItemDeleted = async (root: Context, item: FeedEvent) => {
        let event = UpdateFeedItemDeleted.create({ tid: item.tid, itemId: item.id });
        await Modules.Events.postToFeedTopic(root, item.tid, event);
    }

    onFeedRebuildNeeded = async (root: Context, subscriberId: number) => {
        // TODO: make common feed event
        // await inTx(root, async ctx => {
        //     Store.FeedEventStore.post(ctx, subscriberId, FeedRebuildEvent.create({ subscriberId }));
        // });
    }
}