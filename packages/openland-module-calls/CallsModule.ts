import { MediaKitchenRepository } from './kitchen/MediaKitchenRepository';
import { MediaKitchenService } from './kitchen/MediaKitchenService';
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
import { declareProducerCreateWorker } from './worker/declareProducerCreateWorker';
import { declareProducerDeleteWorker } from './worker/declareProducerDeleteWorker';
import { declareConsumerCreateWorker } from './worker/declareConsumerCreateWorker';
import { declareConsumerDeleteWorker } from './worker/declareConsumerDeleteWorker';
import { declareConsumerUnpauseWorker } from './worker/declareConsumerUnpauseWorker';
import { declareWorkerCleanerWorker } from './worker/declareWorkerCleaner';
import { declarePeerWorker } from './worker/declarePeerWorker';

@injectable()
export class CallsModule {

    @lazyInject('CallRepository')
    repo!: CallRepository;

    @lazyInject('NATS')
    nats!: Client;

    @lazyInject('MediaKitchenRepository')
    mediaKitchenRepo!: MediaKitchenRepository;

    mediaKitchen!: MediaKitchenService;

    start = async () => {
        this.mediaKitchen = new MediaKitchenService(await connectToCluster({ nc: this.nats }));

        if (serverRoleEnabled('calls')) {
            startCallReaper();
            startWorkerTracker(this.mediaKitchen, this.mediaKitchenRepo);
            for (let i = 0; i < 40; i++) {
                declareRouterCreateWorker(this.mediaKitchen, this.mediaKitchenRepo);
                declareRouterDeleteWorker(this.mediaKitchen, this.mediaKitchenRepo);
                declareTransportCreateWorker(this.mediaKitchen, this.mediaKitchenRepo);
                declareTransportConnectWorker(this.mediaKitchen, this.mediaKitchenRepo);
                declareTransportDeleteWorker(this.mediaKitchen, this.mediaKitchenRepo);
                declareProducerCreateWorker(this.mediaKitchen, this.mediaKitchenRepo);
                declareProducerDeleteWorker(this.mediaKitchen, this.mediaKitchenRepo);
                declareConsumerCreateWorker(this.mediaKitchen, this.mediaKitchenRepo);
                declareConsumerDeleteWorker(this.mediaKitchen, this.mediaKitchenRepo);
                declareConsumerUnpauseWorker(this.mediaKitchen, this.mediaKitchenRepo);
                declareWorkerCleanerWorker(this.mediaKitchen, this.mediaKitchenRepo);
                declarePeerWorker(this.repo);
            }
        }
    }
}