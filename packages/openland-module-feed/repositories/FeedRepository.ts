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
import { NotFoundError } from '../../openland-errors/NotFoundError';
import { UserError } from '../../openland-errors/UserError';
import { DoubleInvokeError } from '../../openland-errors/DoubleInvokeError';
import { Modules } from '../../openland-modules/Modules';
import { FeedDeliveryMediator } from './FeedDeliveryMediator';
import { FeedMentionNotificationsMediator } from './FeedMentionNotificationsMediator';

@injectable()
export class FeedRepository {
    @lazyInject('RichMessageRepository')
    private readonly richMessageRepo!: RichMessageRepository;
    @lazyInject('FeedDeliveryMediator')
    private readonly delivery!: FeedDeliveryMediator;
    @lazyInject('FeedMentionNotificationsMediator')
    private readonly mentions!: FeedMentionNotificationsMediator;

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

    async resolveTopic(parent: Context, key: string, global: boolean = false) {
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
            res = await Store.FeedTopic.create(ctx, id, { key, isGlobal: global });
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
        return await inTx(parent, async (ctx) => {
            let t = await this.resolveTopic(ctx, topic);
            let s = await this.resolveSubscriber(ctx, subscriber);
            let ex = await Store.FeedSubscription.findById(ctx, s.id, t.id);
            if (ex) {
                if (!ex.enabled) {
                    ex.enabled = true;
                    return true;
                }
                return false;
            } else {
                await Store.FeedSubscription.create(ctx, s.id, t.id, { enabled: true });
                return true;
            }
        });
    }

    async unsubscribe(parent: Context, subscriber: string, topic: string) {
        return await inTx(parent, async (ctx) => {
            let t = await this.resolveTopic(ctx, topic);
            let s = await this.resolveSubscriber(ctx, subscriber);
            let ex = await Store.FeedSubscription.findById(ctx, s.id, t.id);
            if (ex) {
                if (ex.enabled) {
                    ex.enabled = false;
                    return true;
                }
            }
            return false;
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

            // Subscribe to comments
            await Modules.Comments.notificationsMediator.onNewPeer(ctx, 'feed_item', event.id, uid, message.spans || []);

            await this.delivery.onNewItem(ctx, event);

            await this.mentions.onNewItem(ctx, event, message);

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
            // if (!message.oid && (message.uid !== uid)) {
            //     throw new AccessDeniedError();
            // } else if (message.oid && !await Modules.Orgs.isUserAdmin(ctx, uid, message.oid)) {
            //     throw new AccessDeniedError();
            // }

            //
            // Edit message
            //
            message = await this.richMessageRepo.editRichMessage(ctx, uid, feedEvent.content.richMessageId, input, true);
            feedEvent.edited = true;

            await this.delivery.onItemUpdated(ctx, feedEvent);
            await this.mentions.onItemUpdated(ctx, feedEvent, message);

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
            if (message.deleted || feedEvent.deleted) {
                throw new NotFoundError();
            }
            message.deleted = true;
            feedEvent.deleted = true;

            await this.delivery.onItemDeleted(ctx, feedEvent);

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

            await this.delivery.onItemUpdated(ctx, feedEvent);

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
}