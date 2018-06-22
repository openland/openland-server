import { Transaction } from 'sequelize';
import { EmailWorker } from '../workers';
import { DB } from '../tables';

const TEMPLATE_WELCOME = 'c6a056a3-9d56-4b2e-8d50-7748dd28a1fb';
const TEMPLATE_ACTIVATEED = 'e5b1d39d-35e9-4eba-ac4a-e0676b055346';
const TEMPLATE_DEACTIVATED = 'e1e66916-41be-4719-8eca-7feb0828d600';

const loadUserState = async (uid: number, etx?: Transaction) => {
    return DB.tx(async (tx) => {
        let user = await DB.User.findById(uid, { transaction: tx });
        if (!user) {
            throw Error('Internal inconsistency');
        }
        let profile = await DB.UserProfile.find({
            where: {
                userId: uid
            },
            transaction: tx
        });
        if (profile) {
            return {
                email: user.email!!,
                args: {
                    'userWelcome': 'Hi, ' + profile.firstName,
                    'userName': [profile.firstName, profile.lastName].filter((v) => v).join(' '),
                    'userFirstName': profile.firstName,
                    'userLastName': profile.lastName || ''
                }
            };
        } else {
            return {
                email: user.email!!,
                args: {
                    'userWelcome': 'Hi',
                    'userName': '',
                    'userFirstName': '',
                    'userLastName': ''
                }
            };
        }
    }, etx);
};

export const Emails = {
    async sendWelcomeEmail(uid: number, etx?: Transaction) {
        return await DB.tx(async (tx) => {
            let user = await loadUserState(uid, tx);
            await EmailWorker.pushWork({
                templateId: TEMPLATE_WELCOME,
                to: user.email,
                args: user.args
            }, tx);
        }, etx);
    },
    async sendAccountActivatedEmail(oid: number, etx?: Transaction) {
        await DB.tx(async (tx) => {
            let org = await DB.Organization.findById(oid, { transaction: tx });
            if (!org) {
                throw Error('Unable to find organization');
            }
            let members = await DB.OrganizationMember.findAll({
                where: {
                    orgId: oid
                },
                transaction: tx
            });
            for (let m of members) {
                let user = await loadUserState(m.userId);
                await EmailWorker.pushWork({
                    templateId: TEMPLATE_ACTIVATEED,
                    to: user.email,
                    args: {
                        'organizationName': org.name!!,
                        ...(user.args)
                    }
                }, tx);
            }
        }, etx);
    },
    async sendAccountDeactivatedEmail(oid: number, etx?: Transaction) {
        await DB.tx(async (tx) => {
            let org = await DB.Organization.findById(oid, { transaction: tx });
            if (!org) {
                throw Error('Unable to find organization');
            }
            let members = await DB.OrganizationMember.findAll({
                where: {
                    orgId: oid
                },
                transaction: tx
            });
            for (let m of members) {
                let user = await loadUserState(m.userId);
                await EmailWorker.pushWork({
                    templateId: TEMPLATE_DEACTIVATED,
                    to: user.email,
                    args: {
                        'organizationName': org.name!!,
                        ...(user.args)
                    }
                }, tx);
            }
        }, etx);
    }
};