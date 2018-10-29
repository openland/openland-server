import SendGrid from '@sendgrid/mail';
import { SENDGRID_KEY } from 'openland-server/utils/keys';
import { WorkQueue } from 'openland-module-workers/WorkQueue';
import { createHyperlogger } from 'openland-module-hyperlog/createHyperlogEvent';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';

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

const emailSent = createHyperlogger<{ to: string, templateId: string }>('email_sent');
const emailFailed = createHyperlogger<{ to: string, templateId: string }>('email_failed');

export function createEmailWorker() {
    let queue = new WorkQueue<{ templateId: string, to: string, subject: string, args: { [key: string]: string; } }, { result: string }>('emailSender');
    SendGrid.setApiKey(SENDGRID_KEY);
    let isTesting = process.env.TESTING === 'true';
    if (serverRoleEnabled('workers')) {
        queue.addWorker(async (args, uid) => {
            if (!isTesting) {
                // Filter for non-production envrionments
                if (process.env.APP_ENVIRONMENT !== 'production') {
                    if (devTeamEmails.indexOf(args.to.toLowerCase()) < 0) {
                        return {
                            result: 'ok'
                        };
                    }
                }

                try {
                    await SendGrid.send({
                        to: args.to,
                        from: { name: 'Openland', email: 'support@openland.com' },
                        templateId: args.templateId,
                        substitutions: args.args,
                        subject: args.subject
                    });
                } catch (e) {
                    await emailFailed.event({ templateId: args.templateId, to: args.to });
                    throw e;
                }
                await emailSent.event({ templateId: args.templateId, to: args.to });
            }
            return {
                result: 'ok'
            };
        });
    }
    return queue;
}