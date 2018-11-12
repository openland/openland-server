import { injectable } from 'inversify';
import { lazyInject } from 'openland-modules/Modules.container';
import { AllEntities } from 'openland-module-db/schema';
import { Emails } from 'openland-module-email/Emails';
import { InvitesChannelsRepository } from 'openland-module-messaging/repositories/InvitesRepository';
import { inTx } from 'foundation-orm/inTx';
import { ChannelInviteEmails } from 'openland-module-messaging/emails/ChannelInviteEmails';
import { RoomMediator } from 'openland-module-messaging/mediators/RoomMediator';
import { NotFoundError } from 'openland-errors/NotFoundError';
import { IDs } from 'openland-module-api/IDs';
import { OrganizationModule } from 'openland-module-organization/OrganizationModule';

@injectable()
export class InvitesMediator {
    @lazyInject('FDB')
    private readonly entities!: AllEntities;
    @lazyInject('InvitesRepository')
    private readonly repo!: InvitesChannelsRepository;
    @lazyInject('RoomMediator')
    private readonly rooms!: RoomMediator;
    @lazyInject('OrganizationModule')
    private readonly organizationModule!: OrganizationModule;

    async createChannelInvite(channelId: number, uid: number, email: string, emailText?: string, firstName?: string, lastName?: string) {
        return await inTx(async () => {
            let invite = await this.repo.createChannelInvite(channelId, uid, email, emailText, firstName, lastName);
            await ChannelInviteEmails.sendChannelInviteEmail(invite);
            return invite;
        });
    }

    async joinChannelInvite(uid: number, inviteStr: string) {
        return await inTx(async () => {
            let invite = await this.repo.resolveInvite(inviteStr);
            if (!invite) {
                throw new NotFoundError('Invite not found');
            }
            await this.rooms.joinRoom(invite.channelId, uid);
            await this.activateUser(uid, invite.creatorId);

            return IDs.Conversation.serialize(invite.channelId);
        });
    }

    private async activateUser(uid: number, inviter: number) {
        let user = (await this.entities.User.findById(uid!))!;
        if (user && user.status !== 'activated') {
            await Emails.sendWelcomeEmail(user!.id);
            user.status = 'activated';

            // User set invitedBy if none
            if (inviter && !user.invitedBy) {
                user.invitedBy = inviter;
            }

            (await this.organizationModule.findUserOrganizations(uid)).map(async oid => await this.organizationModule.activateOrganization(oid));
        }
    }
}
