import { WorkQueue } from '../modules/workerQueue';
import * as SendGrid from '@sendgrid/mail';
import { SENDGRID_KEY } from '../keys';

export function createEmailWorker() {
    let queue = new WorkQueue<{ templateId: string, to: string, args: { [key: string]: string; } }, { result: string }>('emailSender');
    SendGrid.setApiKey(SENDGRID_KEY);
    queue.addWorker(async (args, lock, uid) => {
        await SendGrid.send({
            to: args.to,
            from: { name: 'Openland', email: 'support@openland.com' },
            templateId: args.templateId,
            substitutions: args.args
        });
        return {
            result: 'ok'
        };
    });
    return queue;
}