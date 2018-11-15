import { EmailTask } from './EmailTask';
import { Context } from 'openland-utils/Context';

export class EmailModuleMock {

    start = () => {
        // Nothing to do
    }

    enqueueEmail = async (ctx: Context, args: EmailTask) => {
        // Nothing to do
    }
}