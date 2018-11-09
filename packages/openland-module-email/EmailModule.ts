import { EmailTask } from './EmailTask';

export interface EmailModule {
    start(): void;

    enqueueEmail(args: EmailTask): Promise<void>;
}