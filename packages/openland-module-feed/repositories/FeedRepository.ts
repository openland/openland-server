import { getTransaction, inTx } from '@openland/foundationdb';
import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { JsonMap } from 'openland-utils/json';
import { Store } from 'openland-module-db/FDB';
import { lazyInject } from '../../openland-modules/Modules.container';
import {
    RichMessageInput, RichMessageReaction,
    RichMessageRepository
} from '../../openland-module-rich-message/repositories/RichMessageRepository';
import { EventBus } from '../../openland-module-pubsub/EventBus';
import { Pubsub } from '../../openland-module-pubsub/pubsub';
import { NotFoundError } from '../../openland-errors/NotFoundError';
import { UserError } from '../../openland-errors/UserError';
import { AccessDeniedError } from '../../openland-errors/AccessDeniedError';
import { DoubleInvokeError } from '../../openland-errors/DoubleInvokeError';
import { Modules } from '../../openland-modules/Modules';

export type FeedTopicEvent =
    { type: 'new_item', id: number, tid: number } |
    { type: 'edit_item', id: number, tid: number } |
    { type: 'delete_item', id: number, tid: number };

@injectable()
export class FeedRepository {
    @lazyInject('RichMessageRepository')
    private readonly richMessageRepo!: RichMessageRepository;
    private localSub = new Pubsub<FeedTopicEvent>(false);

    constructor() {
        EventBus.subscribe('new_post', async (event: { id: number, tid: number }) => {
            await this.localSub.publish('topic_' + event.tid, { type: 'new_item', id: event.id, tid: event.tid });
        });
        EventBus.subscribe('edit_post', async (event: { id: number, tid: number }) => {
            await this.localSub.publish('topic_' + event.tid, { type: 'edit_item', id: event.id, tid: event.tid });
        });
        EventBus.subscribe('delete_post', async (event: { id: number, tid: number }) => {
            await this.localSub.publish('topic_' + event.tid, { type: 'delete_item', id: event.id, tid: event.tid });
        });
    }

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

    async createEvent(parent: Context, topic: string, type: string, content: JsonMap, repeatKey?: string) {
        return await inTx(parent, async (ctx) => {
            let t = await this.resolveTopic(ctx, topic);

            let seq = (await Store.Sequence.findById(ctx, 'feed-event-id'));
            if (!seq) {
                seq = await Store.Sequence.create(ctx, 'feed-event-id', { value: 0 });
            }
            let id = ++seq.value;
            return await Store.FeedEvent.create(ctx, id, { tid: t.id, content, type, repeatKey });
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
            let userSubscriptions = (await Store.FeedSubscription.subscriber.findAll(ctx, s.id)).map((v) => v.tid);
            let globalTag = await this.resolveTopic(ctx, 'tag-global');
            return [globalTag.id, ...userSubscriptions];
        });
    }

    //
    //  Posts
    //
    async createPost(parent: Context, uid: number, topic: string, input: RichMessageInput & { repeatKey?: string | null }) {
        return inTx(parent, async ctx => {
            let tid = (await this.resolveTopic(ctx, topic))!.id;
            if (input.repeatKey && await Store.FeedEvent.repeat.find(ctx, tid, input.repeatKey)) {
                throw new DoubleInvokeError();
            }
            //
            // Create message
            //
            let message = await this.richMessageRepo.createRichMessage(ctx, uid, input);

            //
            // Create feed item
            //
            let event = await this.createEvent(ctx, topic, 'post', { richMessageId: message.id }, input.repeatKey || undefined);

            getTransaction(ctx).afterCommit(() => EventBus.publish('new_post', { id: event.id, tid: event.tid }));
            return event;
        });
    }

    async editPost(parent: Context, uid: number, eventId: number, input: RichMessageInput) {
        return inTx(parent, async ctx => {
            let feedEvent = await Store.FeedEvent.findById(ctx, eventId);
            if (!feedEvent) {
                throw new NotFoundError();
            }
            if (feedEvent.type !== 'post' || !feedEvent.content.richMessageId) {
                throw new UserError('No post found');
            }
            let message = await Store.RichMessage.findById(ctx, feedEvent.content.richMessageId);
            if (!message) {
                throw new UserError('Message not found');
            }
            if (!message.oid && (message.uid !== uid)) {
                throw new AccessDeniedError();
            } else if (message.oid && !await Modules.Orgs.isUserAdmin(ctx, uid, message.oid)) {
                throw new AccessDeniedError();
            }

            //
            // Edit message
            //
            await this.richMessageRepo.editRichMessage(ctx, uid, feedEvent.content.richMessageId, input, true);
            feedEvent.edited = true;

            getTransaction(ctx).afterCommit(() => EventBus.publish('edit_post', { id: feedEvent!.id, tid: feedEvent!.tid }));
            return feedEvent;
        });
    }

    async deletePost(parent: Context, uid: number, eventId: number) {
        return inTx(parent, async ctx => {
            let feedEvent = await Store.FeedEvent.findById(ctx, eventId);
            if (!feedEvent) {
                throw new NotFoundError();
            }
            if (feedEvent.type !== 'post' || !feedEvent.content.richMessageId) {
                throw new UserError('No post found');
            }
            let message = await Store.RichMessage.findById(ctx, feedEvent.content.richMessageId);
            if (!message) {
                throw new UserError('Message not found');
            }
            message.deleted = true;
            feedEvent.deleted = true;
            getTransaction(ctx).afterCommit(() => EventBus.publish('delete_post', { id: feedEvent!.id, tid: feedEvent!.tid }));
            return true;
        });
    }

    async setReaction(parent: Context, uid: number, eventId: number, reaction: RichMessageReaction, reset: boolean = false) {
        return inTx(parent, async ctx => {
            let feedEvent = await Store.FeedEvent.findById(ctx, eventId);
            if (!feedEvent) {
                throw new NotFoundError();
            }
            if (feedEvent.type !== 'post' || !feedEvent.content.richMessageId) {
                throw new UserError('No post found');
            }
            await this.richMessageRepo.setReaction(ctx, feedEvent.content.richMessageId, uid, reaction, reset);
            getTransaction(ctx).afterCommit(() => EventBus.publish('edit_post', { id: feedEvent!.id, tid: feedEvent!.tid }));
            return true;
        });
    }

    async deliverFeedItemUpdated(parent: Context, eventId: number) {
        return inTx(parent, async ctx => {
            let feedEvent = await Store.FeedEvent.findById(ctx, eventId);
            if (!feedEvent) {
                throw new NotFoundError();
            }
            getTransaction(ctx).afterCommit(() => EventBus.publish('edit_post', { id: feedEvent!.id, tid: feedEvent!.tid }));
            return true;
        });
    }

    //
    //  Events
    //
    async subscribeTopicEvents(tid: number, cb: (event: FeedTopicEvent) => void) {
        return await this.localSub.subscribe('topic_' + tid, cb);
    }
}