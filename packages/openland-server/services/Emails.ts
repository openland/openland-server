import { Transaction } from 'sequelize';
import { EmailWorker } from '../workers';
import { DB } from '../tables';
import { Repos } from '../repositories';
import { OrganizationInvite } from '../tables/OrganizationInvite';
import { ChannelInvite } from '../tables/ChannelInvite';

const TEMPLATE_WELCOME = 'c6a056a3-9d56-4b2e-8d50-7748dd28a1fb';
const TEMPLATE_ACTIVATEED = 'e5b1d39d-35e9-4eba-ac4a-e0676b055346';
const TEMPLATE_DEACTIVATED = 'e1e66916-41be-4719-8eca-7feb0828d600';
const TEMPLATE_MEMBER_REMOVED = '8500f811-f29d-44f1-b1f6-c7975cdeae61';
const TEMPLATE_MEMBERSHIP_LEVEL_CHANGED = '58c94c0c-a033-4406-935f-43fc5265e399';
const TEMPLATE_INVITE = '024815a8-5602-4412-83f4-4be505c2026a';
const TEMPLATE_MEMBER_JOINED = 'c76321cb-5560-4311-bdbf-e0fe337fa2cf';
const TEMPLATE_INVITE_ORGANIZATION = '8130da76-fa72-45a5-982c-f79f50fa396c';
const TEMPLATE_UNREAD_MESSAGES = '02787351-db1c-49b5-afbf-3d63a3b7fd76';
const TEMPLATE_SIGNUP_CODE = '69496416-42cc-441d-912f-a918b968e34a';

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
                subject: 'Welcome to Openland!',
                templateId: TEMPLATE_WELCOME,
                to: user.email,
                args: user.args
            }, tx);
        }, etx);
    },
    async sendUnreadMesages(uid: number, count: number, etx?: Transaction) {
        return await DB.tx(async (tx) => {
            let user = await loadUserState(uid, tx);
            await EmailWorker.pushWork({
                subject: 'You’ve got new messages\n',
                templateId: TEMPLATE_UNREAD_MESSAGES,
                to: user.email,
                args: {
                    messageCount: `${count} new message${count > 1 ? 's' : ''}`,
                    ...user.args
                }
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
                    subject: 'Organization account activated',
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
                    subject: 'Organization account deactivated',
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
                subject: `You were removed from ${org.name!}`,
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
                subject: `Your role at ${org.name!}} was updated`,
                templateId: TEMPLATE_MEMBERSHIP_LEVEL_CHANGED,
                to: user.email,
                args: {
                    levelName,
                    organizationName: org.name!,
                    ...(user.args)
                }
            }, tx);
        });
    },

    async sendInviteEmail(oid: number, invite: OrganizationInvite, tx: Transaction) {
        let org = await DB.Organization.findById(oid, { transaction: tx });
        if (!org) {
            throw Error('Unable to find organization');
        }

        let userWelcome = {
            'userWelcome': invite.memberFirstName ? 'Hi, ' + invite.memberFirstName : 'Hi',
            'userName': [invite.memberFirstName, invite.memberLastName].filter((v) => v).join(' '),
            'userFirstName': invite.memberFirstName || '',
            'userLastName': invite.memberLastName || ''
        };

        let profile = await DB.UserProfile.find({
            where: {
                userId: invite.creatorId
            },
            transaction: tx
        });

        if (!profile) {
            throw Error('Internal inconsistency');
        }

        let domain = process.env.APP_ENVIRONMENT === 'production' ? 'https://app.openland.com/join/' : 'http://localhost:3000/join/';

        await EmailWorker.pushWork({
            subject: `Join ${org.name!} at Openland`,
            templateId: TEMPLATE_INVITE,
            to: invite.forEmail,
            args: {
                firstName: profile.firstName || '',
                lastName: profile.lastName || '',
                customText: invite.emailText || '',
                inviteLink: domain + invite.uuid,
                link: domain + invite.uuid,
                organizationName: org.name!!,
                ...userWelcome
            }
        }, tx);
    },

    async sendOrganizationInviteEmail(oid: number, invite: OrganizationInvite, tx: Transaction) {
        let org = await DB.Organization.findById(oid, { transaction: tx });
        if (!org) {
            throw Error('Unable to find organization');
        }

        let userWelcome = {
            'userWelcome': invite.memberFirstName ? 'Hi, ' + invite.memberFirstName : 'Hi',
            'userName': [invite.memberFirstName, invite.memberLastName].filter((v) => v).join(' '),
            'userFirstName': invite.memberFirstName || '',
            'userLastName': invite.memberLastName || ''
        };

        let profile = await DB.UserProfile.find({
            where: {
                userId: invite.creatorId
            },
            transaction: tx
        });

        if (!profile) {
            throw Error('Internal inconsistency');
        }

        let domain = process.env.APP_ENVIRONMENT === 'production' ? 'https://app.openland.com/invite/' : 'http://localhost:3000/invite/';

        await EmailWorker.pushWork({
            subject: 'Invitation for Openland',
            templateId: TEMPLATE_INVITE_ORGANIZATION,
            to: invite.forEmail,
            args: {
                firstName: profile.firstName || '',
                lastName: profile.lastName || '',
                customText: invite.emailText || '',
                link: domain + invite.uuid,
                'organizationName': org.name!!,
                ...userWelcome
            }
        }, tx);
    },

    async sendMemberJoinedEmails(oid: number, memberId: number, etx?: Transaction) {
        await DB.tx(async (tx) => {
            let org = await DB.Organization.findById(oid, { transaction: tx });
            if (!org) {
                throw Error('Unable to find organization');
            }

            let memberProfile = await DB.UserProfile.find({
                where: {
                    userId: memberId
                },
                transaction: tx
            });

            if (!memberProfile) {
                throw Error('Internal inconsistency');
            }

            let organizationMembers = await Repos.Organizations.getOrganizationMembers(oid);

            for (let member of organizationMembers) {
                let user = await loadUserState(member.userId);

                await EmailWorker.pushWork({
                    subject: 'Invitation accepted',
                    templateId: TEMPLATE_MEMBER_JOINED,
                    to: user.email,
                    args: {
                        memberName: memberProfile.firstName || '',
                        firstName: memberProfile.firstName || '',
                        lastName: memberProfile.lastName || '',
                        link: 'https://app.openland.com/mail',
                        'organizationName': org.name!!,
                        ...(user.args)
                    }
                }, tx);
            }
        });
    },

    async sendDebugEmail(email: string, text: string) {
        await EmailWorker.pushWork({
            subject: 'Debug email',
            templateId: TEMPLATE_INVITE,
            to: email,
            args: {
                customText: text || '',
                inviteLink: 'http://test.com/',
                'organizationName': 'Debug',
                'userWelcome': 'hello'
            }
        });
    },

    async sendChannelInviteEmail(channelId: number, invite: ChannelInvite, tx: Transaction) {
        let channel = await DB.Conversation.findById(channelId, { transaction: tx });
        if (!channel) {
            throw Error('Unable to find channel');
        }

        let userWelcome = {
            'userWelcome': invite.memberFirstName ? 'Hi, ' + invite.memberFirstName : 'Hi',
            'userName': [invite.memberFirstName, invite.memberLastName].filter((v) => v).join(' '),
            'userFirstName': invite.memberFirstName || '',
            'userLastName': invite.memberLastName || ''
        };

        let profile = await DB.UserProfile.find({
            where: {
                userId: invite.creatorId
            },
            transaction: tx
        });

        if (!profile) {
            throw Error('Internal inconsistency');
        }

        let domain = process.env.APP_ENVIRONMENT === 'production' ? 'https://app.openland.com/joinChannel/' : 'http://localhost:3000/joinChannel/';

        await EmailWorker.pushWork({
            subject: `Join ${channel.title!} at Openland`,
            templateId: TEMPLATE_INVITE,
            to: invite.forEmail,
            args: {
                firstName: profile.firstName || '',
                lastName: profile.lastName || '',
                customText: invite.emailText || '',
                inviteLink: domain + invite.uuid,
                link: domain + invite.uuid,
                organizationName: channel.title!!,
                ...userWelcome
            }
        }, tx);
    },

    async sendActivationCodeEmail(email: string, code: string, tx?: Transaction) {
        await EmailWorker.pushWork({
            subject: `Activation code: ` + code,
            templateId: TEMPLATE_SIGNUP_CODE,
            to: email,
            args: {
                code
            }
        }, tx);
    }
};