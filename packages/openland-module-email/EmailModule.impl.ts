import { createEmailWorker } from './workers/EmailWorker';
import { EmailTask } from './EmailTask';
import { injectable } from 'inversify';
import { Context } from '@openland/context';

@injectable()
export class EmailModuleImpl {
    private readonly worker = createEmailWorker();

    start = async () => {
        // Nothing to do
    }

    enqueueEmail = (ctx: Context, args: EmailTask) => {
        this.worker.pushWork(ctx, args);
    }
}