import { HubRepository } from './repositories/HubRepository';
import { injectable } from 'inversify';

@injectable()
export class DiscussionsModule {

    readonly hubs = new HubRepository();

    start = async () => {
        // No op
    }
}