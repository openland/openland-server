import { injectable, inject } from 'inversify';
import { InvitesMediator } from './mediators/InvitesMediator';
import { InvitesChannelsRepository } from './repositories/InvitesChannelsRepository';
import { InvitesOrganizationRepository } from './repositories/InvitesOrganizationRepository';

@injectable()
export class InvitesModule {
    readonly channelsInvitesRepo: InvitesChannelsRepository;
    readonly invitesMediator: InvitesMediator;
    readonly orgInvitesRepo: InvitesOrganizationRepository;

    constructor(
        @inject('InvitesChannelsRepository') channelsInvitesRepo: InvitesChannelsRepository,
        @inject('InvitesChannelsMediator') channelsInvitesMediator: InvitesMediator,
        @inject('InviteRepository') orgInvitesRepo: InvitesOrganizationRepository,
    ) {
        this.channelsInvitesRepo = channelsInvitesRepo;
        this.invitesMediator = channelsInvitesMediator;
        this.orgInvitesRepo = orgInvitesRepo;
    }

    start = () => {
        // Nothing to do
    }

    async getInviteLinkKey(uid: number) {
        return this.orgInvitesRepo.getInviteLinkKey(uid);
    }

    //
    // Channels
    //

    async resolveInvite(id: string) {
        return await this.channelsInvitesRepo.resolveInvite(id);
    }

    async createChannelInviteLink(channelId: number, uid: number) {
        return await this.channelsInvitesRepo.createChannelInviteLink(channelId, uid);
    }

    async refreshChannelInviteLink(channelId: number, uid: number) {
        return await this.channelsInvitesRepo.refreshChannelInviteLink(channelId, uid);
    }

    async createChannelInvite(channelId: number, uid: number, email: string, emailText?: string, firstName?: string, lastName?: string) {
        return await this.invitesMediator.createChannelInvite(channelId, uid, email, emailText, firstName, lastName);
    }

    async joinChannelInvite(uid: number, invite: string) {
        return await this.invitesMediator.joinChannelInvite(uid, invite);
    }
}