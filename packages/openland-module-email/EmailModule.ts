import { EmailTask } from './EmailTask';
import { Context } from 'openland-utils/Context';

export interface EmailModule {
    start(): void;

    enqueueEmail(ctx: Context, args: EmailTask): Promise<void>;
}