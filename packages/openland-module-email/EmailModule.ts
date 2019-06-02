import { EmailTask } from './EmailTask';
import { Context } from '@openland/context';

export interface EmailModule {
    start(): void;

    enqueueEmail(ctx: Context, args: EmailTask): Promise<void>;
}