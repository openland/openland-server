import { DB } from 'openland-server/tables';
import { Modules } from 'openland-modules/Modules';
import { ChannelInvitation } from 'openland-module-db/schema';
const TEMPLATE_INVITE = '024815a8-5602-4412-83f4-4be505c2026a';

export const ChannelInviteEmails = {
    async sendChannelInviteEmail(invite: ChannelInvitation) {
        let channel = await DB.Conversation.findById(invite.channelId);
        if (!channel) {
            throw Error('Unable to find channel');
        }

        let userWelcome = {
            'userWelcome': invite.firstName ? 'Hi, ' + invite.firstName : 'Hi',
            'userName': [invite.lastName, invite.lastName].filter((v) => v).join(' '),
            'userFirstName': invite.firstName || '',
            'userLastName': invite.lastName || ''
        };

        let profile = await Modules.Users.profileById(invite.creatorId);

        if (!profile) {
            throw Error('Internal inconsistency');
        }

        let domain = process.env.APP_ENVIRONMENT === 'production' ? 'https://app.openland.com/joinChannel/' : 'http://localhost:3000/joinChannel/';

        await Modules.Email.Worker.pushWork({
            subject: `Join ${channel.title!} at Openland`,
            templateId: TEMPLATE_INVITE,
            to: invite.email,
            args: {
                firstName: profile.firstName || '',
                lastName: profile.lastName || '',
                customText: invite.text || '',
                inviteLink: domain + invite.id,
                link: domain + invite.id,
                organizationName: channel.title!!,
                ...userWelcome
            }
        });
    }
};