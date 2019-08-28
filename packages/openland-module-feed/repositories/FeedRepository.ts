import { getTransaction, inTx } from '@openland/foundationdb';
import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { JsonMap } from 'openland-utils/json';
import { Store } from 'openland-module-db/FDB';
import { lazyInject } from '../../openland-modules/Modules.container';
import {
    RichMessageInput,
    RichMessageRepository
} from '../../openland-module-rich-message/repositories/RichMessageRepository';
import { EventBus } from '../../openland-module-pubsub/EventBus';

@injectable()
export class FeedRepository {
    @lazyInject('RichMessageRepository')
    private readonly richMessageRepo!: RichMessageRepository;

    //
    // Topics
    //
    async resolveSubscriber(parent: Context, key: string) {
        return await inTx(parent, async (ctx) => {
            let res = await Store.FeedSubscriber.key.find(ctx, key);
            if (res) {
                return res;
            }
            let seq = (await Store.Sequence.findById(ctx, 'feed-subscriber-id'));
            if (!seq) {
                seq = await Store.Sequence.create(ctx, 'feed-subscriber-id', { value: 0 });
            }
            let id = ++seq.value;
            res = await Store.FeedSubscriber.create(ctx, id, { key });

            // Subscribe for own topic
            await this.subscribe(parent, key, key);
            
            return res;
        });
    }

    async resolveTopic(parent: Context, key: string) {
        return await inTx(parent, async (ctx) => {
            let res = await Store.FeedTopic.key.find(ctx, key);
            if (res) {
                return res;
            }
            let seq = (await Store.Sequence.findById(ctx, 'feed-topic-id'));
            if (!seq) {
                seq = await Store.Sequence.create(ctx, 'feed-topic-id', { value: 0 });
            }
            let id = ++seq.value;
            res = await Store.FeedTopic.create(ctx, id, { key });
            return res;
        });
    }

    async createEvent(parent: Context, topic: string, type: string, content: JsonMap) {
        return await inTx(parent, async (ctx) => {
            let t = await this.resolveTopic(ctx, topic);

            let seq = (await Store.Sequence.findById(ctx, 'feed-event-id'));
            if (!seq) {
                seq = await Store.Sequence.create(ctx, 'feed-event-id', { value: 0 });
            }
            let id = ++seq.value;
            return await Store.FeedEvent.create(ctx, id, { tid: t.id, content, type });
        });
    }

    async subscribe(parent: Context, subscriber: string, topic: string) {
        await inTx(parent, async (ctx) => {
            let t = await this.resolveTopic(ctx, topic);
            let s = await this.resolveSubscriber(ctx, subscriber);
            let ex = await Store.FeedSubscription.findById(ctx, s.id, t.id);
            if (ex) {
                ex.enabled = true;
            } else {
                await Store.FeedSubscription.create(ctx, s.id, t.id, { enabled: true });
            }
        });
    }

    async unsubscribe(parent: Context, subscriber: string, topic: string) {
        await inTx(parent, async (ctx) => {
            let t = await this.resolveTopic(ctx, topic);
            let s = await this.resolveSubscriber(ctx, subscriber);
            let ex = await Store.FeedSubscription.findById(ctx, s.id, t.id);
            if (ex) {
                ex.enabled = false;
            }
        });
    }

    async findSubscriptions(parent: Context, subscriber: string) {
        return await inTx(parent, async (ctx) => {
            let s = await this.resolveSubscriber(ctx, subscriber);
            return (await Store.FeedSubscription.subscriber.findAll(ctx, s.id)).map((v) => v.tid);
        });
    }

    //
    //  Posts
    //
    async createPost(parent: Context, uid: number, topic: string, input: RichMessageInput) {
        return inTx(parent, async ctx => {
            //
            // Create message
            //
            let message = await this.richMessageRepo.createRichMessage(ctx, uid, input);

            //
            // Create feed item
            //
            let event = await this.createEvent(ctx, topic, 'post', { richMessageId: message.id });

            getTransaction(ctx).afterCommit(() => {
                EventBus.publish('new_post', { id: event.id, tid: event.tid });
            });
            return event;
        });
    }
}