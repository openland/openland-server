import { Transaction } from 'sequelize';
import { EmailWorker } from '../workers';
import { DB } from '../tables';
import { Repos } from '../repositories';
import { OrganizationInvite } from '../tables/OrganizationInvite';

const TEMPLATE_WELCOME = 'c6a056a3-9d56-4b2e-8d50-7748dd28a1fb';
const TEMPLATE_ACTIVATEED = 'e5b1d39d-35e9-4eba-ac4a-e0676b055346';
const TEMPLATE_DEACTIVATED = 'e1e66916-41be-4719-8eca-7feb0828d600';
const TEMPLATE_MEMBER_REMOVED = '8500f811-f29d-44f1-b1f6-c7975cdeae61';
const TEMPLATE_MEMBERSHIP_LEVEL_CHANGED = '58c94c0c-a033-4406-935f-43fc5265e399';
const TEMPLATE_INVITE = '024815a8-5602-4412-83f4-4be505c2026a';

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
    },

    async sendMemberRemovedEmail(oid: number, uid: number, etx?: Transaction) {
        await DB.tx(async (tx) => {
            let org = await DB.Organization.findById(oid, { transaction: tx });
            if (!org) {
                throw Error('Unable to find organization');
            }

            let user = await loadUserState(uid);

            await EmailWorker.pushWork({
                templateId: TEMPLATE_MEMBER_REMOVED,
                to: user.email,
                args: {
                    'organizationName': org.name!!,
                    ...(user.args)
                }
            }, tx);
        });
    },

    async sendMembershipLevelChangedEmail(oid: number, uid: number, etx?: Transaction) {
        await DB.tx(async (tx) => {
            let org = await DB.Organization.findById(oid, { transaction: tx });
            if (!org) {
                throw Error('Unable to find organization');
            }

            let member = await Repos.Organizations.getOrganizationMember(oid, uid);

            if (!member) {
                throw Error('Unable to find organization');
            }

            let levelName = member.isOwner ? 'owner' : 'member';

            let user = await loadUserState(uid);

            await EmailWorker.pushWork({
                templateId: TEMPLATE_MEMBERSHIP_LEVEL_CHANGED,
                to: user.email,
                args: {
                    levelName,
                    'organizationName': org.name!!,
                    ...(user.args)
                }
            }, tx);
        });
    },

    async sendInviteEmail(oid: number, invite: OrganizationInvite, etx?: Transaction) {
        await DB.tx(async (tx) => {
            let org = await DB.Organization.findById(oid, { transaction: tx });
            if (!org) {
                throw Error('Unable to find organization');
            }

            let userWelcome = {
                'userWelcome': 'Hi',
                'userName': invite.userName || '',
                'userFirstName': '',
                'userLastName': ''
            };

            let domain = process.env.APP_ENVIRONMENT === 'production' ? 'https://openland.com/join/' : 'http://localhost:3000/join/';

            await EmailWorker.pushWork({
                templateId: TEMPLATE_INVITE,
                to: invite.forEmail,
                args: {
                    inviteLink: domain + invite.uuid,
                    'organizationName': org.name!!,
                    ...userWelcome
                }
            }, tx);
        });
    }
};