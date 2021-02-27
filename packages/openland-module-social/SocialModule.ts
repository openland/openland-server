import { injectable, inject } from 'inversify';
import { InfluencerRepository } from './repositories/InfluencerRepository';
import { startInfluencerIndexer } from './workers/startInfluencerIndexing';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { ConnectionsRepository } from './repositories/ConnectionsRepository';
import { startConnectionsIndexer } from './workers/startConnectionsIndexing';
import { lazyInject } from '../openland-modules/Modules.container';
import { FollowersRepository } from './repositories/FollowersRepository';
import { inReadOnlyTx } from '@openland/foundationdb';
import { createNamedContext } from '@openland/context';
import { Events } from '../openland-module-hyperlog/Events';

@injectable()
export class SocialModule {

    readonly repo: InfluencerRepository;
    readonly connections: ConnectionsRepository;

    @lazyInject('FollowersRepository')
    readonly followers!: FollowersRepository;

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

        this.#enableFollowersAnalytics();
    }

    #enableFollowersAnalytics = () => {
        this.followers.onFollow.subscribe(async ({ byUid, uid }) => {
            await inReadOnlyTx(createNamedContext('followers-analytics'), async ctx => {
                Events.FollowEvent.event(ctx, {
                    followed: byUid,
                    follower: uid
                });
            });
        });
    }
}