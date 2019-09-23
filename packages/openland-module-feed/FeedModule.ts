import { injectable, inject } from 'inversify';
import { FeedRepository } from './repositories/FeedRepository';
import { Context } from '@openland/context';
import { JsonMap } from 'openland-utils/json';
import {
    RichMessageInput,
    RichMessageReaction
} from '../openland-module-rich-message/repositories/RichMessageRepository';
import { lazyInject } from '../openland-modules/Modules.container';
import { FeedDeliveryMediator } from './repositories/FeedDeliveryMediator';

@injectable()
export class FeedModule {

    private repo: FeedRepository;

    @lazyInject('FeedDeliveryMediator')
    private readonly delivery!: FeedDeliveryMediator;

    constructor(
        @inject(FeedRepository) repo: FeedRepository
    ) {
        this.repo = repo;
    }

    start = () => {
        this.delivery.start();
    }

    async resolveSubscriber(parent: Context, key: string) {
        return this.repo.resolveSubscriber(parent, key);
    }

    async resolveTopic(parent: Context, key: string) {
        return this.repo.resolveTopic(parent, key);
    }

    async createEvent(parent: Context, topic: string, type: string, content: JsonMap) {
        return this.repo.createEvent(parent, topic, type, content);
    }

    async subscribe(parent: Context, subscriber: string, topic: string) {
        return this.repo.subscribe(parent, subscriber, topic);
    }

    async unsubscribe(parent: Context, subscriber: string, topic: string) {
        return this.repo.unsubscribe(parent, subscriber, topic);
    }

    async findSubscriptions(parent: Context, subscriber: string) {
        return this.repo.findSubscriptions(parent, subscriber);
    }

    async createPost(parent: Context, uid: number, topic: string, input: RichMessageInput) {
        return this.repo.createPost(parent, uid, topic, input);
    }

    async deletePost(parent: Context, uid: number, eventId: number) {
        return this.repo.deletePost(parent, uid, eventId);
    }

    async editPost(parent: Context, uid: number, eventId: number, input: RichMessageInput) {
        return this.repo.editPost(parent, uid, eventId, input);
    }

    async setReaction(parent: Context, uid: number, eventId: number, reaction: RichMessageReaction, reset: boolean = false) {
        return this.repo.setReaction(parent, uid, eventId, reaction, reset);
    }

    async deliverFeedItemUpdated(parent: Context, eventId: number) {
        return this.repo.deliverFeedItemUpdated(parent, eventId);
    }
}