import { injectable, inject } from 'inversify';
import { InfluencerRepository } from './repositories/InfluencerRepository';
import { startInfluencerIndexer } from './workers/startInfluencerIndexing';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';

@injectable()
export class SocialModule {

    readonly repo: InfluencerRepository;

    constructor(@inject(InfluencerRepository) repo: InfluencerRepository) {
        this.repo = repo;
    }

    start = () => {
        if (serverRoleEnabled('workers')) {
            startInfluencerIndexer();
        }
    }
}