import SendGrid from '@sendgrid/mail';
import { WorkQueue } from 'openland-module-workers/WorkQueue';
import { createHyperlogger } from 'openland-module-hyperlog/createHyperlogEvent';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { EmailTask } from 'openland-module-email/EmailTask';
import { createLogger } from '@openland/log';
import { inTx } from '@openland/foundationdb';

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
    'steve+k@openland.com',
    'bot@openland.com'
];

const emailSent = createHyperlogger<{ to: string, templateId: string }>('email_sent');
const emailFailed = createHyperlogger<{ to: string, templateId: string }>('email_failed');
const log = createLogger('sendgrid');

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
                        subject: args.subject,
                        dynamicTemplateData: args.dynamicTemplateData
                    } as any);
                    let statusCode = res[0].statusCode;
                    log.debug(ctx, 'response code: ', statusCode, JSON.stringify(args));
                } catch (e) {
                    log.error(ctx, 'email to', args.to);
                    await inTx(ctx, async (ctx2) => {
                        emailFailed.event(ctx2, { templateId: args.templateId, to: args.to });
                    });
                    throw e;
                }
                await inTx(ctx, async (ctx2) => {
                    emailSent.event(ctx2, { templateId: args.templateId, to: args.to });
                });
            }
            return {
                result: 'ok'
            };
        });
    }
    return queue;
}