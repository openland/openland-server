import SendGrid from '@sendgrid/mail';
import { WorkQueue } from 'openland-module-workers/WorkQueue';
import { createHyperlogger } from 'openland-module-hyperlog/createHyperlogEvent';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { EmailTask } from 'openland-module-email/EmailTask';
import { createLogger } from '../../openland-log/createLogger';

export const SENDGRID_KEY = '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';

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
const log = createLogger('sendgrid', true);

export function createEmailWorker() {
    let queue = new WorkQueue<EmailTask, { result: string }>('emailSender');
    SendGrid.setApiKey(SENDGRID_KEY);
    let isTesting = process.env.TESTING === 'true';
    if (serverRoleEnabled('workers')) {
        queue.addWorker(async (args, ctx) => {
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
                    let res = await SendGrid.send({
                        to: args.to,
                        from: { name: 'Openland', email: 'support@openland.com' },
                        templateId: args.templateId,
                        substitutions: args.args,
                        subject: args.subject
                    });
                    let statusCode = res[0].statusCode;
                    log.debug(ctx, 'response code: ', statusCode, args);
                } catch (e) {
                    await emailFailed.event(ctx, { templateId: args.templateId, to: args.to });
                    throw e;
                }
                await emailSent.event(ctx, { templateId: args.templateId, to: args.to });
            }
            return {
                result: 'ok'
            };
        });
    }
    return queue;
}