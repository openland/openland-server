import { Modules } from 'openland-modules/Modules';
import { OrganizationInviteLink } from 'openland-module-db/schema';
import { IDs } from 'openland-server/api/utils/IDs';
import { FDB } from 'openland-module-db/FDB';
import { inTx } from 'foundation-orm/inTx';

const TEMPLATE_WELCOME = 'c6a056a3-9d56-4b2e-8d50-7748dd28a1fb';
const TEMPLATE_ACTIVATEED = 'e5b1d39d-35e9-4eba-ac4a-e0676b055346';
const TEMPLATE_DEACTIVATED = 'e1e66916-41be-4719-8eca-7feb0828d600';
const TEMPLATE_MEMBER_REMOVED = '8500f811-f29d-44f1-b1f6-c7975cdeae61';
const TEMPLATE_MEMBERSHIP_LEVEL_CHANGED = '58c94c0c-a033-4406-935f-43fc5265e399';
const TEMPLATE_INVITE = '024815a8-5602-4412-83f4-4be505c2026a';
const TEMPLATE_MEMBER_JOINED = 'c76321cb-5560-4311-bdbf-e0fe337fa2cf';
const TEMPLATE_UNREAD_MESSAGES = '02787351-db1c-49b5-afbf-3d63a3b7fd76';
const TEMPLATE_UNREAD_MESSAGE = 'd3c583e1-9418-48ba-b719-4230e1e1d43d';
const TEMPLATE_SIGNUP_CODE = '69496416-42cc-441d-912f-a918b968e34a';

const loadUserState = async (uid: number) => {
    let user = await FDB.User.findById(uid);
    if (!user) {
        throw Error('Internal inconsistency');
    }
    let profile = await Modules.Users.profileById(uid);
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
};

export const Emails = {
    async sendWelcomeEmail(uid: number) {
        let user = await loadUserState(uid);
        await Modules.Email.Worker.pushWork({
            subject: 'Welcome to Openland!',
            templateId: TEMPLATE_WELCOME,
            to: user.email,
            args: user.args
        });
    },
    async sendUnreadMesages(uid: number, count: number) {
        let user = await loadUserState(uid);
        await Modules.Email.Worker.pushWork({
            subject: count === 1 ? 'You’ve got a new message' : 'You’ve got new messages',
            templateId: count === 1 ? TEMPLATE_UNREAD_MESSAGE : TEMPLATE_UNREAD_MESSAGES,
            to: user.email,
            args: {
                messageCount: `${count}`,
                ...user.args
            }
        });
    },
    async sendAccountActivatedEmail(oid: number) {
        await inTx(async () => {
            let org = await FDB.Organization.findById(oid);
            if (!org) {
                throw Error('Unable to find organization');
            }
            let orgProfile = await FDB.OrganizationProfile.findById(oid);
            let members = await FDB.OrganizationMember.allFromOrganization('joined', oid);
            for (let m of members) {
                let user = await loadUserState(m.uid);
                await Modules.Email.Worker.pushWork({
                    subject: 'Organization account activated',
                    templateId: TEMPLATE_ACTIVATEED,
                    to: user.email,
                    args: {
                        'organizationName': orgProfile!.name,
                        ...(user.args)
                    }
                });
            }
        });
    },
    async sendAccountDeactivatedEmail(oid: number) {
        await inTx(async () => {
            let org = await FDB.Organization.findById(oid);
            if (!org) {
                throw Error('Unable to find organization');
            }
            let orgProfile = (await FDB.OrganizationProfile.findById(oid))!;
            let members = await FDB.OrganizationMember.allFromOrganization('joined', oid);
            for (let m of members) {
                let user = await loadUserState(m.uid);
                await Modules.Email.Worker.pushWork({
                    subject: 'Organization account deactivated',
                    templateId: TEMPLATE_DEACTIVATED,
                    to: user.email,
                    args: {
                        'organizationName': orgProfile.name,
                        ...(user.args)
                    }
                });
            }
        });
    },

    async sendMemberRemovedEmail(oid: number, uid: number) {
        await inTx(async () => {
            let org = await FDB.Organization.findById(oid);
            if (!org) {
                throw Error('Unable to find organization');
            }

            let orgProfile = (await FDB.OrganizationProfile.findById(oid))!;
            let user = await loadUserState(uid);

            await Modules.Email.Worker.pushWork({
                subject: `You were removed from ${orgProfile.name!}`,
                templateId: TEMPLATE_MEMBER_REMOVED,
                to: user.email,
                args: {
                    'organizationName': orgProfile.name!!,
                    ...(user.args)
                }
            });
        });
    },

    async sendMembershipLevelChangedEmail(oid: number, uid: number) {
        await inTx(async () => {
            let org = await FDB.Organization.findById(oid);
            if (!org) {
                throw Error('Unable to find organization');
            }

            let member = await Modules.Orgs.fundUserMembership(uid, oid);

            if (!member) {
                throw Error('Unable to find organization');
            }

            let levelName = member.role === 'admin' ? 'owner' : 'member';

            let user = await loadUserState(uid);

            let orgProfile = (await FDB.OrganizationProfile.findById(oid))!;

            await Modules.Email.Worker.pushWork({
                subject: `Your role at ${orgProfile.name!}} was updated`,
                templateId: TEMPLATE_MEMBERSHIP_LEVEL_CHANGED,
                to: user.email,
                args: {
                    levelName,
                    organizationName: orgProfile.name!,
                    ...(user.args)
                }
            });
        });
    },

    async sendInviteEmail(oid: number, invite: OrganizationInviteLink) {
        await inTx(async () => {
            let org = await FDB.Organization.findById(oid);
            if (!org) {
                throw Error('Unable to find organization');
            }

            let userWelcome = {
                'userWelcome': invite.firstName ? 'Hi, ' + invite.firstName : 'Hi',
                'userName': [invite.firstName, invite.lastName].filter((v) => v).join(' '),
                'userFirstName': invite.firstName || '',
                'userLastName': invite.lastName || ''
            };

            let profile = await Modules.Users.profileById(invite.uid);

            if (!profile) {
                throw Error('Internal inconsistency');
            }

            let domain = process.env.APP_ENVIRONMENT === 'production' ? 'https://app.openland.com/join/' : 'http://localhost:3000/join/';
            let orgProfile = (await FDB.OrganizationProfile.findById(oid))!;
            await Modules.Email.Worker.pushWork({
                subject: `Join ${orgProfile.name!} at Openland`,
                templateId: TEMPLATE_INVITE,
                to: invite.email,
                args: {
                    firstName: profile.firstName || '',
                    lastName: profile.lastName || '',
                    customText: invite.text || '',
                    inviteLink: domain + invite.id,
                    link: domain + invite.id,
                    organizationName: orgProfile.name!!,
                    ...userWelcome
                }
            });
        });
    },

    // async sendOrganizationInviteEmail(oid: number, invite: OrganizationInvite, tx: Transaction) {
    //     let org = await DB.Organization.findById(oid, { transaction: tx });
    //     if (!org) {
    //         throw Error('Unable to find organization');
    //     }

    //     let userWelcome = {
    //         'userWelcome': invite.memberFirstName ? 'Hi, ' + invite.memberFirstName : 'Hi',
    //         'userName': [invite.memberFirstName, invite.memberLastName].filter((v) => v).join(' '),
    //         'userFirstName': invite.memberFirstName || '',
    //         'userLastName': invite.memberLastName || ''
    //     };

    //     let profile = await Modules.Users.profileById(invite.creatorId);

    //     if (!profile) {
    //         throw Error('Internal inconsistency');
    //     }

    //     let domain = process.env.APP_ENVIRONMENT === 'production' ? 'https://app.openland.com/invite/' : 'http://localhost:3000/invite/';

    //     await Modules.Email.Worker.pushWork({
    //         subject: 'Invitation for Openland',
    //         templateId: TEMPLATE_INVITE_ORGANIZATION,
    //         to: invite.forEmail,
    //         args: {
    //             firstName: profile.firstName || '',
    //             lastName: profile.lastName || '',
    //             customText: invite.emailText || '',
    //             link: domain + invite.uuid,
    //             'organizationName': org.name!!,
    //             ...userWelcome
    //         }
    //     });
    // },

    async sendMemberJoinedEmails(oid: number, memberId: number) {
        await inTx(async () => {
            let org = await FDB.Organization.findById(oid);
            if (!org) {
                throw Error('Unable to find organization');
            }

            let memberProfile = await Modules.Users.profileById(memberId);

            if (!memberProfile) {
                throw Error('Internal inconsistency');
            }

            let organizationMembers = await Modules.Orgs.findOrganizationMembers(oid);
            let orgProfile = (await FDB.OrganizationProfile.findById(oid))!;
            for (let member of organizationMembers) {
                let user = await loadUserState(member.id);

                await Modules.Email.Worker.pushWork({
                    subject: 'Invitation accepted',
                    templateId: TEMPLATE_MEMBER_JOINED,
                    to: user.email,
                    args: {
                        memberName: memberProfile.firstName || '',
                        firstName: memberProfile.firstName || '',
                        lastName: memberProfile.lastName || '',
                        link: 'https://app.openland.com/mail/' + IDs.User.serialize(memberId),
                        'organizationName': orgProfile.name!!,
                        ...(user.args)
                    }
                });
            }
        });
    },

    async sendDebugEmail(email: string, text: string) {
        await Modules.Email.Worker.pushWork({
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

    async sendActivationCodeEmail(email: string, code: string) {
        await Modules.Email.Worker.pushWork({
            subject: `Activation code: ` + code,
            templateId: TEMPLATE_SIGNUP_CODE,
            to: email,
            args: {
                code
            }
        });
    }
};