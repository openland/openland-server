import { injectable } from 'inversify';
import { lazyInject } from 'openland-modules/Modules.container';
import { InvitesRoomRepository } from '../repositories/InvitesRoomRepository';
import { inTx } from 'foundation-orm/inTx';
import { ChannelInviteEmails } from 'openland-module-messaging/emails/ChannelInviteEmails';
import { RoomMediator } from 'openland-module-messaging/mediators/RoomMediator';
import { NotFoundError } from 'openland-errors/NotFoundError';
import { IDs } from 'openland-module-api/IDs';
import { Modules } from 'openland-modules/Modules';
import { ErrorText } from 'openland-errors/ErrorText';
import { InvitesOrganizationRepository } from 'openland-module-invites/repositories/InvitesOrganizationRepository';
import { Context } from 'openland-utils/Context';
import { Emails } from '../../openland-module-email/Emails';

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
            await ChannelInviteEmails.sendChannelInviteEmail(ctx, invite);
            return invite;
        });
    }

    async joinRoomInvite(parent: Context, uid: number, inviteStr: string) {
        return await inTx(parent, async (ctx) => {
            let invite = await this.repoChannels.resolveInvite(ctx, inviteStr);
            if (!invite) {
                throw new NotFoundError('Invite not found');
            }
            await this.rooms.joinRoom(ctx, invite.channelId, uid, false, true);
            await Modules.Users.activateUser(ctx, uid);
            await this.activateUserOrgs(ctx, uid);

            return invite.channelId;
        });
    }

    async joinAppInvite(ctx: Context, uid: number, inviteStr: string) {
        let inviteData = await this.repoOrgs.getAppInvteLinkData(ctx, inviteStr);
        if (!inviteData) {
            throw new NotFoundError(ErrorText.unableToFindInvite);
        }
        await Modules.Users.activateUser(ctx, uid);
        await this.activateUserOrgs(ctx, uid);
        return 'ok';
    }

    async joinOrganizationInvite(parent: Context, uid: number, inviteString: string) {
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

            await Modules.Orgs.addUserToOrganization(ctx, uid, invite.oid, invite.uid);

            // invalidate invite
            if (orgInvite) {
                orgInvite.joined = true;
            }
            await Emails.sendMemberJoinedEmails(ctx, invite.oid, uid);

            return IDs.Organization.serialize(invite.oid);

        });
    }

    private async activateUserOrgs(ctx: Context, uid: number) {
        await Promise.all((await Modules.Orgs.findUserOrganizations(ctx, uid)).map(async oid => await Modules.Orgs.activateOrganization(ctx, oid)));
    }
}
