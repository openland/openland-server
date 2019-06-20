import { inTx } from '@openland/foundationdb';
import { injectable } from 'inversify';
import { lazyInject } from 'openland-modules/Modules.container';
import { InvitesRoomRepository } from '../repositories/InvitesRoomRepository';
// import { ChannelInviteEmails } from 'openland-module-messaging/emails/ChannelInviteEmails';
import { RoomMediator } from 'openland-module-messaging/mediators/RoomMediator';
import { NotFoundError } from 'openland-errors/NotFoundError';
import { IDs } from 'openland-module-api/IDs';
import { Modules } from 'openland-modules/Modules';
import { ErrorText } from 'openland-errors/ErrorText';
import { InvitesOrganizationRepository } from 'openland-module-invites/repositories/InvitesOrganizationRepository';
import { Context } from '@openland/context';
import { Emails } from '../../openland-module-email/Emails';
import { UserError } from '../../openland-errors/UserError';
import { FDB } from '../../openland-module-db/FDB';
import { trackServerEvent } from '../../openland-module-hyperlog/Log.resolver';

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
            await this.activateUserOrgs(ctx, uid, !isNewUser, 'ROOM', invite.creatorId);
            if (invite.entityName === 'ChannelInvitation') {
                await Emails.sendRoomInviteAcceptedEmail(ctx, uid, invite);
            }
            let chat = await FDB.ConversationRoom.findById(ctx, invite.channelId);
            await trackServerEvent(ctx, { name: 'invited_contact_joined', uid: invite.creatorId, args: { invite_type: chat!.isChannel ? 'channel' : 'group' } });
            return invite.channelId;
        });
    }

    async joinAppInvite(parent: Context, uid: number, inviteStr: string, isNewUser: boolean) {
        return await inTx(parent, async (ctx) => {
            let inviteData = await this.repoOrgs.getAppInvteLinkData(ctx, inviteStr);
            if (!inviteData) {
                throw new NotFoundError(ErrorText.unableToFindInvite);
            }
            await Modules.Users.activateUser(ctx, uid, isNewUser);
            await this.activateUserOrgs(ctx, uid, !isNewUser, 'APP', inviteData.uid);
            let chat = await Modules.Messaging.room.resolvePrivateChat(ctx, uid, inviteData.uid);
            let name1 = await Modules.Users.getUserFullName(ctx, uid);
            let name2 = await Modules.Users.getUserFullName(ctx, inviteData.uid);

            let supportUserId = await Modules.Users.getSupportUserId(ctx);

            if (!supportUserId) {
                return;
            }

            await Modules.Messaging.sendMessage(
                ctx,
                chat.id,
                supportUserId,
                { message: `🙌 ${name2} — ${name1} has accepted your invite. Now you can chat!`, isService: true },
                true
            );
            await trackServerEvent(ctx, { name: 'invited_contact_joined', uid: inviteData.uid, args: { invite_type: 'Openland' } });
            return 'ok';
        });
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
            let ex = await FDB.OrganizationMember.findById(ctx, invite.oid, uid);
            let org = (await FDB.Organization.findById(ctx, invite.oid))!;
            let profile = (await FDB.OrganizationProfile.findById(ctx, invite.oid))!;

            if (ex && ex.status === 'left') {
                throw new UserError(`Unfortunately, you cannot join ${profile.name}. One of ${org.kind === 'organization' ? 'organization' : 'community'} admins kicked you from ${profile.name}, and now you can only join it if a member adds you.`, 'CANT_JOIN_ORG');
            }

            await Modules.Orgs.addUserToOrganization(ctx, uid, invite.oid, invite.uid, false, isNewUser);

            // invalidate invite
            if (orgInvite) {
                orgInvite.joined = true;
            }

            let chat = await Modules.Messaging.room.resolvePrivateChat(ctx, uid, invite.uid);
            let name1 = await Modules.Users.getUserFullName(ctx, uid);
            let name2 = await Modules.Users.getUserFullName(ctx, invite.uid);

            let supportUserId = await Modules.Users.getSupportUserId(ctx);

            if (supportUserId) {
                await Modules.Messaging.sendMessage(
                    ctx,
                    chat.id,
                    supportUserId,
                    { message: `🙌 ${name2} — ${name1} has accepted your invite. Now you can chat!`, isService: true },
                    true
                );
            }
            // await Emails.sendMemberJoinedEmails(ctx, invite.oid, uid);

            await trackServerEvent(ctx, { name: 'invited_contact_joined', uid: invite.uid, args: { invite_type: org.kind } });
            return IDs.Organization.serialize(invite.oid);
        });
    }

    private async activateUserOrgs(ctx: Context, uid: number, sendEmail: boolean, inviteType: 'APP' | 'ROOM', inviteOwner: number) {
        let userOrgs = await Modules.Orgs.findUserOrganizations(ctx, uid);
        for (let oid of userOrgs) {
            if (await Modules.Orgs.activateOrganization(ctx, oid, sendEmail)) {
                await Modules.Hooks.onOrganizationActivated(ctx, oid, { type: 'BY_INVITE', inviteType, inviteOwner });
            }
        }
    }
}
