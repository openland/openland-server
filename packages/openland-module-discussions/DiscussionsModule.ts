import { HubRepository } from './repositories/HubRepository';
import { injectable } from 'inversify';
import { DiscussionsRepository } from './repositories/DiscussionsRepository';

@injectable()
export class DiscussionsModule {

    readonly hubs = new HubRepository();
    readonly discussions = new DiscussionsRepository();

    start = async () => {
        // No op
    }
}