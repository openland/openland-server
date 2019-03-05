import { injectable } from 'inversify';
import { lazyInject } from 'openland-modules/Modules.container';
import { InvitesRoomRepository } from '../repositories/InvitesRoomRepository';
import { inTx } from 'foundation-orm/inTx';
// import { ChannelInviteEmails } from 'openland-module-messaging/emails/ChannelInviteEmails';
import { RoomMediator } from 'openland-module-messaging/mediators/RoomMediator';
import { NotFoundError } from 'openland-errors/NotFoundError';
import { IDs } from 'openland-module-api/IDs';
import { Modules } from 'openland-modules/Modules';
import { ErrorText } from 'openland-errors/ErrorText';
import { InvitesOrganizationRepository } from 'openland-module-invites/repositories/InvitesOrganizationRepository';
import { Context } from 'openland-utils/Context';
import { Emails } from '../../openland-module-email/Emails';
import { UserError } from '../../openland-errors/UserError';

@injectable()
export class InvitesMediator {
    @lazyInject('InvitesRoomRepository')
    private readonly repoChannels!: InvitesRoomRepository;
    @lazyInject('InvitesOrganizationRepository')
    private readonly repoOrgs!: InvitesOrganizationRepository;
    @lazyInject('RoomMediator')
    private readonly rooms!: RoomMediator;

    async createRoomInvite(parent: Context, channelId: number, uid: number, email: string, emailText?: string, firstName?: string, lastName?: string) {
        return await inTx(parent, async (ctx) => {
            let invite = await this.repoChannels.createChannelInvite(ctx, channelId, uid, email, emailText, firstName, lastName);
            // await ChannelInviteEmails.sendChannelInviteEmail(ctx, invite);
            await Emails.sendRoomInviteEmail(ctx, uid, invite.email, channelId, invite);
            return invite;
        });
    }

    async joinRoomInvite(parent: Context, uid: number, inviteStr: string, isNewUser: boolean) {
        return await inTx(parent, async (ctx) => {
            let invite = await this.repoChannels.resolveInvite(ctx, inviteStr);
            if (!invite) {
                throw new NotFoundError('Invite not found');
            }
            await this.rooms.joinRoom(ctx, invite.channelId, uid, false, true);
            await Modules.Users.activateUser(ctx, uid, isNewUser);
            await this.activateUserOrgs(ctx, uid, !isNewUser);
            if (invite.entityName === 'ChannelInvitation') {
                await Emails.sendRoomInviteAcceptedEmail(ctx, uid, invite);
            }
            return invite.channelId;
        });
    }

    async joinAppInvite(ctx: Context, uid: number, inviteStr: string, isNewUser: boolean) {
        let inviteData = await this.repoOrgs.getAppInvteLinkData(ctx, inviteStr);
        if (!inviteData) {
            throw new NotFoundError(ErrorText.unableToFindInvite);
        }
        await Modules.Users.activateUser(ctx, uid, isNewUser);
        await this.activateUserOrgs(ctx, uid, !isNewUser);
        let chat = await Modules.Messaging.room.resolvePrivateChat(ctx, uid, inviteData.uid);
        let name1 = await Modules.Users.getUserFullName(ctx, uid);
        let name2 = await Modules.Users.getUserFullName(ctx, inviteData.uid);

        await Modules.Messaging.sendMessage(
            ctx,
            chat.id,
            Modules.Users.SUPPORT_USER_ID,
            { message: `🙌 ${name2} — ${name1} has accepted your invite. Now you can chat!`, isService: true },
            true
        );
        return 'ok';
    }

    async createOrganizationInvite(ctx: Context, oid: number, uid: number, inviteReq: { email: string; emailText?: string, firstName?: string; lastName?: string }) {
        let isMemberDuplicate = await Modules.Orgs.hasMemberWithEmail(ctx, oid, inviteReq.email);
        if (isMemberDuplicate) {
            throw new UserError(ErrorText.memberWithEmailAlreadyExists);
        }

        let invite = await Modules.Invites.orgInvitesRepo.createOrganizationInvite(
            ctx,
            oid,
            uid,
            inviteReq.firstName || '',
            inviteReq.lastName || '',
            inviteReq.email,
            inviteReq.emailText || ''
        );

        await Emails.sendInviteEmail(ctx, oid, invite);

        return invite;
    }

    async joinOrganizationInvite(parent: Context, uid: number, inviteString: string, isNewUser: boolean) {
        return await inTx(parent, async (ctx) => {
            let orgInvite = await Modules.Invites.orgInvitesRepo.getOrganizationInviteNonJoined(ctx, inviteString);
            let publicOrginvite = await Modules.Invites.orgInvitesRepo.getOrganizationInviteLinkByKey(ctx, inviteString);
            let invite: { oid: number, uid: number, ttl?: number | null, role?: string } | null = orgInvite || publicOrginvite;

            if (!invite) {
                throw new NotFoundError(ErrorText.unableToFindInvite);
            }

            if (invite.ttl && (new Date().getTime() >= invite.ttl)) {
                throw new NotFoundError(ErrorText.unableToFindInvite);
            }

            await Modules.Orgs.addUserToOrganization(ctx, uid, invite.oid, invite.uid, false, isNewUser);

            // invalidate invite
            if (orgInvite) {
                orgInvite.joined = true;
            }
            await Emails.sendMemberJoinedEmails(ctx, invite.oid, uid);

            return IDs.Organization.serialize(invite.oid);

        });
    }

    private async activateUserOrgs(ctx: Context, uid: number, sendEmail: boolean) {
        await Promise.all((await Modules.Orgs.findUserOrganizations(ctx, uid)).map(async oid => await Modules.Orgs.activateOrganization(ctx, oid, sendEmail)));
    }
}
