import { MediaKitchenRepository } from './repositories/MediaKitchenRepository';
import { MediaKitchenService } from './services/MediaKitchenService';
import { injectable } from 'inversify';
import { lazyInject } from 'openland-modules/Modules.container';
import { CallRepository } from './repositories/CallRepository';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { startCallReaper } from './worker/startCallReaper';
import { startWorkerTracker } from './worker/startWorkerTracker';
import { connectToCluster } from 'mediakitchen';
import { Client } from 'ts-nats';
import { declareRouterCreateWorker } from './worker/declareRouterCreateWorker';
import { declareRouterDeleteWorker } from './worker/declareRouterDeleteWorker';
import { declareTransportCreateWorker } from './worker/declareTransportCreateWorker';
import { declareTransportConnectWorker } from './worker/declareTransportConnectWorker';
import { declareTransportDeleteWorker } from './worker/declareTransportDeleteWorker';

@injectable()
export class CallsModule {

    @lazyInject(CallRepository)
    repo!: CallRepository;

    @lazyInject('NATS')
    nats!: Client;

    @lazyInject('MediaKitchenRepository')
    mediaKitchenRepo!: MediaKitchenRepository;

    mediaKitchen!: MediaKitchenService;

    start = async () => {
        this.mediaKitchen = new MediaKitchenService(await connectToCluster({ nc: this.nats }));

        if (serverRoleEnabled('workers')) {
            startCallReaper();
            startWorkerTracker(this.mediaKitchen, this.mediaKitchenRepo);
            declareRouterCreateWorker(this.mediaKitchen, this.mediaKitchenRepo);
            declareRouterDeleteWorker(this.mediaKitchen, this.mediaKitchenRepo);
            declareTransportCreateWorker(this.mediaKitchen, this.mediaKitchenRepo);
            declareTransportConnectWorker(this.mediaKitchen, this.mediaKitchenRepo);
            declareTransportDeleteWorker(this.mediaKitchen, this.mediaKitchenRepo);
        }
    }
}