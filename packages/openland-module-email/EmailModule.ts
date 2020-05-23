import { EmailTask } from './EmailTask';
import { Context } from '@openland/context';

export interface EmailModule {
    start(): Promise<void>;

    enqueueEmail(ctx: Context, args: EmailTask): Promise<void>;
}