import { ChannelInvitation } from 'openland-module-db/store';
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
import { Store } from '../../openland-module-db/FDB';
import { buildMessage, userMention } from '../../openland-utils/MessageBuilder';

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

            await Modules.Users.activateUser(ctx, uid, isNewUser, invite.creatorId);
            await this.activateUserOrgs(ctx, uid, !isNewUser, 'ROOM', invite.creatorId);

            let chat = await Store.ConversationRoom.findById(ctx, invite.channelId);
            await this.rooms.joinRoom(ctx, invite.channelId, uid, false, true);
            await Modules.Metrics.onChatInviteJoin(ctx, uid, invite.creatorId, chat!);
            if (invite instanceof ChannelInvitation) {
                await Emails.sendRoomInviteAcceptedEmail(ctx, uid, invite);
            }
            return invite.channelId;
        });
    }

    async joinAppInvite(parent: Context, uid: number, inviteStr: string, isNewUser: boolean) {
        return await inTx(parent, async (ctx) => {
            let inviteData = await this.repoOrgs.getAppInvteLinkData(ctx, inviteStr);
            if (!inviteData) {
                throw new NotFoundError(ErrorText.unableToFindInvite);
            }
            // Do nothing if chat with inviter created
            let user = (await Store.User.findById(ctx, uid))!;
            let privateChat = await Store.ConversationPrivate.users.find(ctx, Math.min(user.id, inviteData.uid), Math.max(user.id, inviteData.uid));
            if (privateChat) {
                return 'ok';
            }
            await Modules.Metrics.onOpenlandInviteJoin(ctx, uid, inviteData.uid);
            await Modules.Users.activateUser(ctx, uid, isNewUser, inviteData.uid);
            await this.activateUserOrgs(ctx, uid, !isNewUser, 'APP', inviteData.uid);
            let chat = await Modules.Messaging.room.resolvePrivateChat(ctx, uid, inviteData.uid);
            let name1 = await Modules.Users.getUserFullName(ctx, uid);
            let name2 = await Modules.Users.getUserFullName(ctx, inviteData.uid);

            let supportUserId = await Modules.Users.getSupportUserId(ctx);

            if (!supportUserId) {
                return 'ok';
            }

            await Modules.Messaging.sendMessage(
                ctx,
                chat.id,
                supportUserId,
                {
                    ...buildMessage(`🙌 `, userMention(name2, inviteData.uid), ' — ', userMention(name1, uid), ' has accepted your invite. Now you can chat!'),
                    isService: true
                },
                true
            );
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

            let user = (await Store.User.findById(ctx, uid))!;
            let isActivatedAlready = user.status === 'activated';

            let ex = await Store.OrganizationMember.findById(ctx, invite.oid, uid);
            let org = (await Store.Organization.findById(ctx, invite.oid))!;
            let profile = (await Store.OrganizationProfile.findById(ctx, invite.oid))!;

            if (ex && ex.status === 'left') {
                throw new UserError(`Unfortunately, you cannot join ${profile.name}. One of ${org.kind === 'organization' ? 'organization' : 'community'} admins kicked you from ${profile.name}, and now you can only join it if a member adds you.`, 'CANT_JOIN_ORG');
            }
            await Modules.Metrics.onOrganizationInviteJoin(ctx, uid, invite.oid, org);

            await Modules.Orgs.addUserToOrganization(ctx, uid, invite.oid, invite.uid, false, isNewUser);

            // invalidate invite
            if (orgInvite) {
                orgInvite.joined = true;
            }

            let chat = await Modules.Messaging.room.resolvePrivateChat(ctx, uid, invite.uid);
            let name1 = await Modules.Users.getUserFullName(ctx, uid);
            let name2 = await Modules.Users.getUserFullName(ctx, invite.uid);

            let supportUserId = await Modules.Users.getSupportUserId(ctx);

            if (supportUserId && !isActivatedAlready) {
                await Modules.Messaging.sendMessage(
                    ctx,
                    chat.id,
                    supportUserId,
                    {
                        ...buildMessage(`🙌 `, userMention(name2, invite.uid), ' — ', userMention(name1, uid), ' has accepted your invite. Now you can chat!'),
                        isService: true
                    },
                    true
                );
            }
            // await Emails.sendMemberJoinedEmails(ctx, invite.oid, uid);
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
