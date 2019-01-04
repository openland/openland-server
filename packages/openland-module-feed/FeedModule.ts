import { injectable, inject } from 'inversify';
import { FeedRepository } from './repositories/FeedRepository';
import { Context } from 'openland-utils/Context';

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

    start = () => {
        // Do nothing
    }
}