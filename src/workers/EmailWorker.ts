import { WorkQueue } from '../modules/workerQueue';
import SendGrid from '@sendgrid/mail';
import { SENDGRID_KEY } from '../utils/keys';

export function createEmailWorker() {
    let queue = new WorkQueue<{ templateId: string, to: string, args: { [key: string]: string; } }, { result: string }>('emailSender');
    SendGrid.setApiKey(SENDGRID_KEY);
    let isTesting = process.env.TESTING === 'true';
    queue.addWorker(async (args, lock, uid) => {
        if (!isTesting) {
            await SendGrid.send({
                to: args.to,
                from: { name: 'Openland', email: 'support@openland.com' },
                templateId: args.templateId,
                substitutions: args.args
            });
        }
        return {
            result: 'ok'
        };
    });
    return queue;
}