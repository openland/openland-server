import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { lazyInject } from '../../openland-modules/Modules.container';
import { AuthManagementRepository } from '../repositories/AuthManagementRepository';
import { inTx } from '@openland/foundationdb';
import { Store } from '../../openland-module-db/FDB';
import { UserError } from '../../openland-errors/UserError';
import { createPersistenceThrottle } from '../../openland-utils/PersistenceThrottle';
import { NotFoundError } from '../../openland-errors/NotFoundError';
import { createOneTimeCodeGenerator } from '../../openland-utils/OneTimeCode';
import { Emails } from '../../openland-module-email/Emails';

const emailChangeThrottle = createPersistenceThrottle('email_change');
const emailChangeCode = createOneTimeCodeGenerator<{ oldEmail: string, newEmail: string, uid: number }>('email_change', 60 * 5, 5, 6);

@injectable()
export class AuthManagementMediator {
    @lazyInject('AuthManagementRepository')
    private readonly authManagement!: AuthManagementRepository;

    async sendEmailChangeCode(parent: Context, uid: number, newEmail: string) {
        return await inTx(parent, async ctx => {
            let email = newEmail.toLocaleLowerCase().trim();

            let user = await Store.User.findById(ctx, uid);
            if (!user) {
                throw new NotFoundError();
            }

            // Check user have email at this point
            if (!user.email) {
                throw new UserError(`You don't have email yet`);
            }

            // Check that email is not used
            let existingUser = await Store.User.email.find(ctx, email);
            if (existingUser) {
                throw new UserError('This email is already used');
            }

            // Check that we are not sending email to often
            let timeout = await emailChangeThrottle.nextFireTimeout(ctx, email);
            if (timeout > 0) {
                throw new UserError('Sorry, you can\'t send email to often');
            }

            // Create code
            let code = await emailChangeCode.create(ctx, { oldEmail: user.email, newEmail: email, uid });

            // Send code
            await Emails.sendActivationCodeEmail(ctx, email, code.code, true);
            await emailChangeThrottle.onFire(ctx, email);

            return true;
        });
    }

    async changeEmail(parent: Context, uid: number, confirmationCode: string) {
        return await inTx(parent, async ctx => {
            let code = await emailChangeCode.findByCode(ctx, confirmationCode);
            if (!code) {
                throw new UserError(`Wrong code`);
            }

            // Check uid
            if (code.data.uid !== uid) {
                throw new UserError(`Wrong code`);
            }

            // Change email
            await this.authManagement.changeEmail(ctx, uid, code.data.newEmail);

            // Inform about change
            await Emails.sendGenericEmailTo(ctx, code.data.oldEmail, {
                title: 'Your email was changed',
                text: `Your email was changed to ${code.data.newEmail}, if this was not you please contact us`,
                link: 'https://openland.com/mail/LOaDEWDj9zsVv999DDpJiEj05K',
                buttonText: 'contact support'
            });

            return true;
        });
    }
}
