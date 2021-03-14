import { Context } from '@openland/context';
import SendGrid from '@sendgrid/mail';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { EmailTask } from 'openland-module-email/EmailTask';
import { createLogger } from '@openland/log';
import { Config } from 'openland-config/Config';
import { BetterWorkerQueue } from 'openland-module-workers/BetterWorkerQueue';
import { Store } from 'openland-module-db/FDB';
import { MailData } from '@sendgrid/helpers/classes/mail';

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

    let sendMessage = async (ctx: Context, args: EmailTask[]) => {
        if (Config.environment !== 'test') {

            // Map data
            let data: MailData[] = [];
            if (Config.environment !== 'production') {
                for (let arg of args) {
                    if (
                        devTeamEmails.indexOf(arg.to.toLowerCase()) < 0 &&
                        !arg.to.endsWith('@affecting.org')
                    ) {
                        continue;
                    }
                    if (!arg.to || (arg.to || '').trim().length === 0) {
                        continue;
                    }
                    data.push({
                        to: arg.to,
                        from: { name: 'Openland', email: 'support@openland.com' },
                        templateId: arg.templateId,
                        substitutions: arg.args,
                        subject: arg.subject,
                        dynamicTemplateData: arg.dynamicTemplateData
                    });
                }
            }

            if (data.length) {
                return;
            }

            try {
                let res = await SendGrid.send(data, true);
                let statusCode = res[0].statusCode;
                log.debug(ctx, 'response code: ', statusCode, JSON.stringify(args));
            } catch (e) {
                log.error(ctx, 'Email send faild: ' + e);
                throw e;
            }
        }
    };

    // Configure sendgrid
    SendGrid.setApiKey(SENDGRID_KEY);

    let beterQueue = new BetterWorkerQueue<EmailTask>(Store.EmailSendQueue, { maxAttempts: 3, type: 'external' });
    if (serverRoleEnabled('workers')) {
        beterQueue.addBatchedWorkers(10, 100, async (ctx, args) => {
            await sendMessage(ctx, args);
        });
    }
    return beterQueue;
}
