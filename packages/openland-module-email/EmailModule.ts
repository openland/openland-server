import { createEmailWorker } from './workers/EmailWorker';

export class EmailModule {
    readonly Worker = createEmailWorker();
    start = () => {
        // Nothing to do
    }
}