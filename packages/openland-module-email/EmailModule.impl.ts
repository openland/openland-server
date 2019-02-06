// import { createEmailWorker } from './workers/EmailWorker';
import { EmailTask } from './EmailTask';
import { injectable } from 'inversify';
import { Context } from 'openland-utils/Context';

@injectable()
export class EmailModuleImpl {
    // private readonly worker = createEmailWorker();

    start = () => {
        // Nothing to do
    }

    enqueueEmail = async (ctx: Context, args: EmailTask) => {
        // await this.worker.pushWork(ctx, args);
    }
}