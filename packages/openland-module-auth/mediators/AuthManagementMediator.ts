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
import { Modules } from '../../openland-modules/Modules';
import { templated } from '../../openland-module-messaging/texts/util';

const emailChangeThrottle = createPersistenceThrottle('email_change');
const emailChangeCode = createOneTimeCodeGenerator<{ oldEmail: string | null, email: string, uid: number }>('email_change', 60 * 5, 5, 6);

const phonePairSMSThrottle = createPersistenceThrottle('phone_change');
const phonePairCode = createOneTimeCodeGenerator<{ oldPhone: string | null, phone: string, uid: number }>('phone_pair', 60 * 5, 5, 6);

const Texts = {
    PhoneChanged_SMS: templated<{ phone: string }>(`Your phone was changed to {{phone}}, if this was not you please contact us`),
    PhonePaired_Email: templated<{ phone: string }>(`You have paired phone: {{phone}} to your Openland account, if this was not you please contact us`),
    PhoneChanged_Email: templated<{ phone: string }>(`Your phone was changed to {{phone}}, if this was not you please contact us`),

    EmailPaired_SMS: templated<{ email: string }>(`You have paired email: {{email}} to your Openland account, if this was not you please contact us`),
    EmailChanged_SMS: templated<{ email: string }>(`Your email was changed to {{email}}, if this was not you please contact us`),
    EmailChanged_Email: templated<{ email: string }>(`Your email was changed to {{email}}, if this was not you please contact us`),
};

@injectable()
export class AuthManagementMediator {
    @lazyInject('AuthManagementRepository')
    private readonly authManagement!: AuthManagementRepository;

    //
    // Email
    //
    async sendEmailPairCode(parent: Context, uid: number, newEmail: string) {
        return await inTx(parent, async ctx => {
            let email = newEmail.toLocaleLowerCase().trim();

            let user = await Store.User.findById(ctx, uid);
            if (!user) {
                throw new NotFoundError();
            }

            // Check that email is not used
            let existingUser = await Store.User.email.find(ctx, email);
            if (existingUser) {
                throw new UserError('This email is already used');
            }

            // Check that we are not sending email too often
            let timeout = await emailChangeThrottle.nextFireTimeout(ctx, email);
            if (timeout > 0) {
                throw new UserError('Sorry, you can\'t send email to often');
            }

            // Create code
            let code = await emailChangeCode.create(ctx, {oldEmail: user.email, email: email, uid});

            // Send code
            await Emails.sendActivationCodeEmail(ctx, email, code.code, true);
            await emailChangeThrottle.onFire(ctx, email);

            return code.id;
        });
    }

    async pairEmail(parent: Context, uid: number, sessionId: string, confirmationCode: string) {
        await inTx(withoutTransaction(parent), async ctx => {
            // Store use attempt
            await emailChangeCode.onUseAttempt(ctx, sessionId);
        });
        return await inTx(parent, async ctx => {
            let user = await Store.User.findById(ctx, uid);
            if (!user) {
                throw new NotFoundError();
            }

            let code = await emailChangeCode.findById(ctx, sessionId);
            if (!code) {
                throw new UserError(`Wrong code`);
            }

            let isChange = !!code.data.oldEmail;

            // Check uid
            if (code.data.uid !== uid) {
                throw new UserError(`Wrong code`);
            }
            // Check code
            if (code.code !== confirmationCode) {
                throw new UserError(`Wrong code`);
            }

            // Change email
            await this.authManagement.pairEmail(ctx, uid, code.data.email);

            // Inform about change
            if (code.data.oldEmail) {
                await Emails.sendGenericEmailTo(ctx, code.data.oldEmail, {
                    title: 'Your email was changed',
                    text: Texts.EmailChanged_Email({email: code.data.email}),
                    link: 'https://openland.com/mail/LOaDEWDj9zsVv999DDpJiEj05K',
                    buttonText: 'contact support'
                });
            }
            if (user.phone) {
                await SmsService.sendSms(ctx, user.phone, isChange ? Texts.EmailChanged_SMS({email: code.data.email}) : Texts.EmailPaired_SMS({email: code.data.email}));
            }

            // Mark code user
            await emailChangeCode.onUse(ctx, confirmationCode);

            // Release throttle
            await emailChangeThrottle.release(ctx, code.data.email);

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

            // Check that phone is not used
            let existingUser = await Store.User.fromPhone.find(ctx, phone);
            if (existingUser) {
                throw new UserError('This phone is already used');
            }

            // Check that we are not sending sms to often
            let timeout = await phonePairSMSThrottle.nextFireTimeout(ctx, phone);
            if (timeout > 0) {
                throw new UserError('Sorry, you can\'t send code to often');
            }

            // Create code
            let code = await phonePairCode.create(ctx, {oldPhone: user.phone, phone, uid});

            // Send code
            await SmsService.sendSms(ctx, phone, `Openland code: ${code.code}. Valid for 5 minutes.`);
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
            if (!code) {
                throw new UserError(`Wrong code`);
            }

            let isChange = !!code.data.oldPhone;

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
            if (code.data.oldPhone) {
                await SmsService.sendSms(ctx, code.data.oldPhone, Texts.PhoneChanged_SMS({phone: code.data.phone}));
            }
            if (user.email) {
                await Emails.sendGenericEmailTo(ctx, user.email, {
                    title: isChange ? 'Your phone was changed' : 'You have paired phone',
                    text: isChange ? Texts.PhoneChanged_Email({phone: code.data.phone}) : Texts.PhonePaired_Email({phone: code.data.phone}),
                    link: 'https://openland.com/mail/LOaDEWDj9zsVv999DDpJiEj05K',
                    buttonText: 'contact support'
                });
            }

            // Mark code used
            await phonePairCode.onUse(ctx, confirmationCode);

            // Release throttle
            await emailChangeThrottle.release(ctx, code.data.phone);

            // Send notifications
            await Modules.Phonebook.onPhonePair(ctx, user.id);

            return true;
        });
    }
}
