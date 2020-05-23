import { injectable, inject } from 'inversify';
import { InfluencerRepository } from './repositories/InfluencerRepository';
import { startInfluencerIndexer } from './workers/startInfluencerIndexing';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { ConnectionsRepository } from './repositories/ConnectionsRepository';
import { startConnectionsIndexer } from './workers/startConnectionsIndexing';

@injectable()
export class SocialModule {

    readonly repo: InfluencerRepository;
    readonly connections: ConnectionsRepository;

    constructor(
        @inject(InfluencerRepository) repo: InfluencerRepository,
        @inject(ConnectionsRepository) connections: ConnectionsRepository
    ) {
        this.repo = repo;
        this.connections = connections;
    }

    start = async () => {
        if (serverRoleEnabled('workers')) {
            startInfluencerIndexer();
            startConnectionsIndexer();
        }
    }
}