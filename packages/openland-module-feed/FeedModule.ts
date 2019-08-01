import { injectable, inject } from 'inversify';
import { FeedRepository } from './repositories/FeedRepository';
import { Context } from '@openland/context';
import { JsonMap } from 'openland-utils/json';
import { RichMessageInput } from '../openland-module-rich-message/repositories/RichMessageRepository';

@injectable()
export class FeedModule {

    private repo: FeedRepository;

    constructor(
        @inject(FeedRepository) repo: FeedRepository
    ) {
        this.repo = repo;
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

    async subsctibe(parent: Context, subscriber: string, topic: string) {
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

    start = () => {
        // Do nothing
    }
}