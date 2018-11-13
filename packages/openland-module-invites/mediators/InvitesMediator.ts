import { injectable } from 'inversify';
import { lazyInject } from 'openland-modules/Modules.container';
import { InvitesChannelsRepository } from '../repositories/InvitesChannelsRepository';
import { inTx } from 'foundation-orm/inTx';
import { ChannelInviteEmails } from 'openland-module-messaging/emails/ChannelInviteEmails';
import { RoomMediator } from 'openland-module-messaging/mediators/RoomMediator';
import { NotFoundError } from 'openland-errors/NotFoundError';
import { IDs } from 'openland-module-api/IDs';
import { Modules } from 'openland-modules/Modules';
import { ErrorText } from 'openland-errors/ErrorText';
import { InvitesOrganizationRepository } from 'openland-module-invites/repositories/InvitesOrganizationRepository';

@injectable()
export class InvitesMediator {
    @lazyInject('InvitesChannelsRepository')
    private readonly repoChannels!: InvitesChannelsRepository;
    @lazyInject('InvitesOrganizationRepository')
    private readonly repoOrgs!: InvitesOrganizationRepository;
    @lazyInject('RoomMediator')
    private readonly rooms!: RoomMediator;

    async createChannelInvite(channelId: number, uid: number, email: string, emailText?: string, firstName?: string, lastName?: string) {
        return await inTx(async () => {
            let invite = await this.repoChannels.createChannelInvite(channelId, uid, email, emailText, firstName, lastName);
            await ChannelInviteEmails.sendChannelInviteEmail(invite);
            return invite;
        });
    }

    async joinChannelInvite(uid: number, inviteStr: string) {
        return await inTx(async () => {
            let invite = await this.repoChannels.resolveInvite(inviteStr);
            if (!invite) {
                throw new NotFoundError('Invite not found');
            }
            await this.rooms.joinRoom(invite.channelId, uid);
            await this.activateUserOrgs(uid);

            return IDs.Conversation.serialize(invite.channelId);
        });
    }

    async joinAppInvite(uid: number, inviteStr: string) {
        let inviteData = await this.repoOrgs.getAppInvteLinkData(inviteStr);
        if (!inviteData) {
            throw new NotFoundError(ErrorText.unableToFindInvite);
        }
        // tem fix, remove after activation called after create profile/org on client
        await Modules.Users.activateUser(uid);
        
        await this.activateUserOrgs(uid);
        return 'ok';
    }

    async joinOrganizationInvite(uid: number, inviteString: string) {
        return await inTx(async () => {
            let orgInvite = await Modules.Invites.orgInvitesRepo.getOrganizationInviteNonJoined(inviteString);
            let publicOrginvite = await Modules.Invites.orgInvitesRepo.getOrganizationInviteLinkByKey(inviteString);
            let invite: { oid: number, uid: number, ttl?: number | null, role?: string } | null = orgInvite || publicOrginvite;

            if (!invite) {
                throw new NotFoundError(ErrorText.unableToFindInvite);
            }

            if (invite.ttl && (new Date().getTime() >= invite.ttl)) {
                throw new NotFoundError(ErrorText.unableToFindInvite);
            }

            await Modules.Orgs.addUserToOrganization(uid, invite.oid, invite.uid);

            // invalidate invite
            if (orgInvite) {
                orgInvite.joined = true;
            }
            return IDs.Organization.serialize(invite.oid);

        });
    }

    private async activateUserOrgs(uid: number) {
        await Promise.all((await Modules.Orgs.findUserOrganizations(uid)).map(async oid => await Modules.Orgs.activateOrganization(oid)));
    }
}
