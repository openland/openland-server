import SendGrid from '@sendgrid/mail';
import { WorkQueue } from 'openland-module-workers/workerQueue';
import { SENDGRID_KEY } from 'openland-server/utils/keys';

let devTeamEmails = [
    'korshakov.stepan@gmail.com',
    'steve@openland.com',
    'yury@openland.com',
    'max@openland.com',
    'gleb@openland.com',
    'narek@openland.com',
    'xeroxaltox@gmail.com',
    'nabovyan@bk.ru',
    'steve+kite@openland.com',
    'steve+k@openland.com'
];

export function createEmailWorker() {
    let queue = new WorkQueue<{ templateId: string, to: string, subject: string, args: { [key: string]: string; } }, { result: string }>('emailSender');
    SendGrid.setApiKey(SENDGRID_KEY);
    let isTesting = process.env.TESTING === 'true';
    queue.addWorker(async (args, lock, uid) => {
        if (!isTesting) {
            // Filter for non-production envrionments
            if (process.env.APP_ENVIRONMENT !== 'production') {
                if (devTeamEmails.indexOf(args.to.toLowerCase()) < 0) {
                    return {
                        result: 'ok'
                    };
                }
            }
            console.warn('Sending email task #' + uid);

            await SendGrid.send({
                to: args.to,
                from: { name: 'Openland', email: 'support@openland.com' },
                templateId: args.templateId,
                substitutions: args.args,
                subject: args.subject
            });
        }
        return {
            result: 'ok'
        };
    });
    return queue;
}