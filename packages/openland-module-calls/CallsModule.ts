import { injectable } from 'inversify';
import { lazyInject } from 'openland-modules/Modules.container';
import { CallRepository } from './repositories/CallRepository';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { startCallReaper } from './worker/startCallReaper';
import { connectToCluster, Cluster } from 'mediakitchen';
import { Client } from 'ts-nats';

@injectable()
export class CallsModule {

    @lazyInject(CallRepository)
    repo!: CallRepository;

    @lazyInject('NATS')
    nats!: Client;

    cluster!: Cluster;

    start = async () => {
        this.cluster = await connectToCluster({ nc: this.nats });
        
        if (serverRoleEnabled('workers')) {
            startCallReaper();
        }
    }
}