import { MediaKitchenService } from './services/MediaKitchenService';
import { injectable } from 'inversify';
import { lazyInject } from 'openland-modules/Modules.container';
import { CallRepository } from './repositories/CallRepository';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { startCallReaper } from './worker/startCallReaper';
import { connectToCluster } from 'mediakitchen';
import { Client } from 'ts-nats';

@injectable()
export class CallsModule {

    @lazyInject(CallRepository)
    repo!: CallRepository;

    @lazyInject('NATS')
    nats!: Client;

    mediaKitchen!: MediaKitchenService;

    start = async () => {
        this.mediaKitchen = new MediaKitchenService(await connectToCluster({ nc: this.nats }));

        if (serverRoleEnabled('workers')) {
            startCallReaper();
        }
    }
}