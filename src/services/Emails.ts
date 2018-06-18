import { Transaction } from 'sequelize';
import { EmailWorker } from '../workers';
import { User } from '../tables';
import { UserProfile } from '../tables/UserProfile';

const TEMPLATE_WELCOME = 'c6a056a3-9d56-4b2e-8d50-7748dd28a1fb';

export const Emails = {
    sendWelcomeEmail(user: User, profile: UserProfile, tx?: Transaction) {
        return EmailWorker.pushWork({
            templateId: TEMPLATE_WELCOME,
            to: user.email!!,
            args: {
                'userName': [profile.firstName, profile.lastName].filter((v) => v).join(' '),
                'userFirstName': profile.firstName,
                'userLastName': profile.lastName || ''
            }
        }, tx);
    }
};