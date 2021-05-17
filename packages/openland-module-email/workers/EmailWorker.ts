import { Context } from '@openland/context';
import SendGrid from '@sendgrid/mail';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { EmailTask } from 'openland-module-email/EmailTask';
import { createLogger } from '@openland/log';
import { Config } from 'openland-config/Config';
import { BetterWorkerQueue } from 'openland-module-workers/BetterWorkerQueue';
import { Store } from 'openland-module-db/FDB';

export const SENDGRID_KEY = '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';

let devTeamEmails = [
    'korshakov.stepan@gmail.com',
    'steve@openland.com',
    'yury@openland.com',
    'max@openland.com',
    'max+1@openland.com',
    'max+2@openland.com',
    'gleb@openland.com',
    'narek@openland.com',
    'xeroxaltox@gmail.com',
    'nabovyan@bk.ru',
    'steve+kite@openland.com',
    'steve+k@openland.com',
    'bot@openland.com',
    'danila@openland.com',
    'krigga7@gmail.com'
];

const log = createLogger('sendgrid');

export function createEmailWorker() {

    let sendMessage = async (ctx: Context, args: EmailTask) => {
        if (Config.environment !== 'test') {
            // Filter for non-production envrionments
            if (Config.environment !== 'production') {
                if (
                    devTeamEmails.indexOf(args.to.toLowerCase()) < 0 &&
                    !args.to.endsWith('@affecting.org')
                ) {
                    return;
                }
            }

            if (!args.to || (args.to || '').trim().length === 0) {
                log.warn(ctx, 'empty email receiver', args);
                return;
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
                throw e;
            }
        }
    };

    // Configure sendgrid
    SendGrid.setApiKey(SENDGRID_KEY);

    let beterQueue = new BetterWorkerQueue<EmailTask>(Store.EmailSendQueue, { maxAttempts: 3, type: 'external' });
    if (serverRoleEnabled('workers')) {
        beterQueue.addWorkers(100, async (ctx, args) => {
            await sendMessage(ctx, args);
        });
    }
    return beterQueue;
}
