import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { lazyInject } from '../../openland-modules/Modules.container';
import { AuthManagementRepository } from '../repositories/AuthManagementRepository';
import { inTx, withoutTransaction } from '@openland/foundationdb';
import { Store } from '../../openland-module-db/FDB';
import { UserError } from '../../openland-errors/UserError';
import { createPersistenceThrottle } from '../../openland-utils/PersistenceThrottle';
import { NotFoundError } from '../../openland-errors/NotFoundError';
import { createOneTimeCodeGenerator } from '../../openland-utils/OneTimeCode';
import { Emails } from '../../openland-module-email/Emails';
import { SmsService } from '../../openland-utils/SmsService';

const emailChangeThrottle = createPersistenceThrottle('email_change');
const emailChangeCode = createOneTimeCodeGenerator<{ oldEmail: string, newEmail: string, uid: number }>('email_change', 60 * 5, 5, 6);

const phonePairSMSThrottle = createPersistenceThrottle('phone_change');
const phonePairCode = createOneTimeCodeGenerator<{ phone: string, uid: number }>('phone_pair', 60 * 5, 5, 6);

@injectable()
export class AuthManagementMediator {
    @lazyInject('AuthManagementRepository')
    private readonly authManagement!: AuthManagementRepository;

    //
    // Email
    //
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
            let code = await emailChangeCode.create(ctx, {oldEmail: user.email, newEmail: email, uid});

            // Send code
            await Emails.sendActivationCodeEmail(ctx, email, code.code, true);
            await emailChangeThrottle.onFire(ctx, email);

            return code.id;
        });
    }

    async changeEmail(parent: Context, uid: number, sessionId: string, confirmationCode: string) {
        await inTx(withoutTransaction(parent), async ctx => {
            // Store use attempt
            await emailChangeCode.onUseAttempt(ctx, sessionId);
        });
        return await inTx(parent, async ctx => {
            let code = await emailChangeCode.findById(ctx, sessionId);
            if (!code) {
                throw new UserError(`Wrong code`);
            }

            // Check uid
            if (code.data.uid !== uid) {
                throw new UserError(`Wrong code`);
            }
            // Check code
            if (code.code !== confirmationCode) {
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

            // Mark code user
            await emailChangeCode.onUse(ctx, confirmationCode);

            // Release throttle
            await emailChangeThrottle.release(ctx, code.data.newEmail);

            return true;
        });
    }

    //
    //  Phone
    //
    async sendPhonePairCode(parent: Context, uid: number, phone: string) {
        return await inTx(parent, async ctx => {
            let user = await Store.User.findById(ctx, uid);
            if (!user) {
                throw new NotFoundError();
            }

            // Check user have phone at this point
            if (user.phone) {
                throw new UserError(`You already have paired phone`);
            }

            // Check that phone is not used
            let existingUser = await Store.User.phone.find(ctx, phone);
            if (existingUser) {
                throw new UserError('This phone is already used');
            }

            // Check that we are not sending sms to often
            let timeout = await phonePairSMSThrottle.nextFireTimeout(ctx, phone);
            if (timeout > 0) {
                throw new UserError('Sorry, you can\'t send code to often');
            }

            // Create code
            let code = await phonePairCode.create(ctx, {phone, uid});

            // Send code
            await SmsService.sendSms(phone, `Openland code: ${code.code}. Valid for 5 minutes.`);
            await phonePairSMSThrottle.onFire(ctx, phone);

            return code.id;
        });
    }

    async pairPhone(parent: Context, uid: number, sessionId: string, confirmationCode: string) {
        await inTx(withoutTransaction(parent), async ctx => {
            // Store use attempt
            await phonePairCode.onUseAttempt(ctx, sessionId);
        });

        return await inTx(parent, async ctx => {
            let user = await Store.User.findById(ctx, uid);
            if (!user) {
                throw new NotFoundError();
            }

            let code = await phonePairCode.findById(ctx, sessionId);
            // console.log(code, sessionId);
            if (!code) {
                throw new UserError(`Wrong code`);
            }

            // Check uid
            if (code.data.uid !== uid) {
                throw new UserError(`Wrong code`);
            }
            // Check code
            if (code.code !== confirmationCode) {
                throw new UserError(`Wrong code`);
            }

            // Pair phone
            await this.authManagement.pairPhone(ctx, uid, code.data.phone);

            // Inform about pairing
            if (user.email) {
                await Emails.sendGenericEmailTo(ctx, user.email, {
                    title: 'You have paired phone',
                    text: `You have paired phone: ${code.data.phone} to your Openland account, if this was not you please contact us`,
                    link: 'https://openland.com/mail/LOaDEWDj9zsVv999DDpJiEj05K',
                    buttonText: 'contact support'
                });
            }

            // Mark code user
            await phonePairCode.onUse(ctx, confirmationCode);

            // Release throttle
            await emailChangeThrottle.release(ctx, code.data.phone);

            return true;
        });
    }
}
