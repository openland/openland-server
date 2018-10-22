import { createAugmentationWorker } from './AugmentationWorker';

export class MessagingModule {
    AugmentationWorker = createAugmentationWorker();
    start = () => {
        // Nothing to do
    }
}