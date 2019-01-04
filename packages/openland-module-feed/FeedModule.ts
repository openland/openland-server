import { injectable, inject } from 'inversify';
import { FeedRepository } from './repositories/FeedRepository';
import { Context } from 'openland-utils/Context';
import { JsonMap } from 'openland-utils/json';

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
        return this.repo.subsctibe(parent, subscriber, topic);
    }

    async unsubscribe(parent: Context, subscriber: string, topic: string) {
        return this.repo.unsubscribe(parent, subscriber, topic);
    }

    async findSubscriptions(parent: Context, subscriber: string) {
        return this.repo.findSubscriptions(parent, subscriber);
    }

    start = () => {
        // Do nothing
    }
}