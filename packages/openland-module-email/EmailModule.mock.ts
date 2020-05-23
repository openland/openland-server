import { EmailTask } from './EmailTask';
import { Context } from '@openland/context';

export class EmailModuleMock {

    start = async () => {
        // Nothing to do
    }

    enqueueEmail = async (ctx: Context, args: EmailTask) => {
        // Nothing to do
    }
}