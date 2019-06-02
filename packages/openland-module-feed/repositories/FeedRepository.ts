import { injectable } from 'inversify';
import { lazyInject } from 'openland-modules/Modules.container';
import { AllEntities } from 'openland-module-db/schema';
import { Context } from '@openland/context';
import { inTx } from 'foundation-orm/inTx';
import { JsonMap } from 'openland-utils/json';

@injectable()
export class FeedRepository {

    @lazyInject('FDB')
    private readonly entities!: AllEntities;

    async resolveSubscriber(parent: Context, key: string) {
        return await inTx(parent, async (ctx) => {
            let res = await this.entities.FeedSubscriber.findFromKey(ctx, key);
            if (res) {
                return res;
            }
            let seq = (await this.entities.Sequence.findById(ctx, 'feed-subscriber-id'));
            if (!seq) {
                seq = await this.entities.Sequence.create(ctx, 'feed-subscriber-id', { value: 0 });
            }
            let id = ++seq.value;
            res = await this.entities.FeedSubscriber.create(ctx, id, { key });

            // Subscribe for own topic
            await this.subsctibe(parent, key, key);
            
            return res;
        });
    }

    async resolveTopic(parent: Context, key: string) {
        return await inTx(parent, async (ctx) => {
            let res = await this.entities.FeedTopic.findFromKey(ctx, key);
            if (res) {
                return res;
            }
            let seq = (await this.entities.Sequence.findById(ctx, 'feed-topic-id'));
            if (!seq) {
                seq = await this.entities.Sequence.create(ctx, 'feed-topic-id', { value: 0 });
            }
            let id = ++seq.value;
            res = await this.entities.FeedTopic.create(ctx, id, { key });
            return res;
        });
    }

    async createEvent(parent: Context, topic: string, type: string, content: JsonMap) {
        return await inTx(parent, async (ctx) => {
            let t = await this.resolveTopic(ctx, topic);

            let seq = (await this.entities.Sequence.findById(ctx, 'feed-event-id'));
            if (!seq) {
                seq = await this.entities.Sequence.create(ctx, 'feed-event-id', { value: 0 });
            }
            let id = ++seq.value;
            return await this.entities.FeedEvent.create(ctx, id, { tid: t.id, content, type });
        });
    }

    async subsctibe(parent: Context, subscriber: string, topic: string) {
        await inTx(parent, async (ctx) => {
            let t = await this.resolveTopic(ctx, topic);
            let s = await this.resolveSubscriber(ctx, subscriber);
            let ex = await this.entities.FeedSubscription.findById(ctx, s.id, t.id);
            if (ex) {
                ex.enabled = true;
            } else {
                await this.entities.FeedSubscription.create(ctx, s.id, t.id, { enabled: true });
            }
        });
    }

    async unsubscribe(parent: Context, subscriber: string, topic: string) {
        await inTx(parent, async (ctx) => {
            let t = await this.resolveTopic(ctx, topic);
            let s = await this.resolveSubscriber(ctx, subscriber);
            let ex = await this.entities.FeedSubscription.findById(ctx, s.id, t.id);
            if (ex) {
                ex.enabled = false;
            }
        });
    }

    async findSubscriptions(parent: Context, subscriber: string) {
        return await inTx(parent, async (ctx) => {
            let s = await this.resolveSubscriber(ctx, subscriber);
            return (await this.entities.FeedSubscription.allFromSubscriber(ctx, s.id)).map((v) => v.tid);
        });
    }
}