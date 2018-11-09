import { createEmailWorker } from './workers/EmailWorker';
import { EmailTask } from './EmailTask';
import { injectable } from 'inversify';

@injectable()
export class EmailModule {
    private readonly worker = createEmailWorker();

    start = () => {
        // Nothing to do
    }

    enqueueEmail = async (args: EmailTask) => {
        await this.worker.pushWork(args);
    }
}