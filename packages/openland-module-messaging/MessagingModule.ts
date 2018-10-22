import { createAugmentationWorker } from './workers/AugmentationWorker';

export class MessagingModule {
    AugmentationWorker = createAugmentationWorker();
    start = () => {
        // Nothing to do
    }
}