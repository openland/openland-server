import { HubRepository } from './repositories/HubRepository';
import { injectable } from 'inversify';
import { PostsRepository } from './repositories/PostsRepository';

@injectable()
export class DiscussionsModule {

    readonly hubs = new HubRepository();
    readonly discussions = new PostsRepository();

    start = async () => {
        // No op
    }
}