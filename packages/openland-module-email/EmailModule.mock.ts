import { EmailTask } from './EmailTask';

export class EmailModuleMock {

    start = () => {
        // Nothing to do
    }

    enqueueEmail = async (args: EmailTask) => {
        // await this.worker.pushWork(args);
    }
}