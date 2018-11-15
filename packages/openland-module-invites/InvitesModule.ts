import { injectable, inject } from 'inversify';
import { InvitesMediator } from './mediators/InvitesMediator';
import { InvitesChannelsRepository } from './repositories/InvitesChannelsRepository';
import { InvitesOrganizationRepository } from './repositories/InvitesOrganizationRepository';
import { Context } from 'openland-utils/Context';

@injectable()
export class InvitesModule {
    readonly channelsInvitesRepo: InvitesChannelsRepository;
    readonly invitesMediator: InvitesMediator;
    readonly orgInvitesRepo: InvitesOrganizationRepository;

    constructor(
        @inject('InvitesChannelsRepository') channelsInvitesRepo: InvitesChannelsRepository,
        @inject('InvitesMediator') channelsInvitesMediator: InvitesMediator,
        @inject('InvitesOrganizationRepository') orgInvitesRepo: InvitesOrganizationRepository,
    ) {
        this.channelsInvitesRepo = channelsInvitesRepo;
        this.invitesMediator = channelsInvitesMediator;
        this.orgInvitesRepo = orgInvitesRepo;
    }

    start = () => {
        // Nothing to do
    }

    async getInviteLinkKey(ctx: Context, uid: number) {
        return this.orgInvitesRepo.getAppInviteLinkKey(ctx, uid);
    }

    //
    // Channels
    //

    async resolveInvite(ctx: Context, id: string) {
        return await this.channelsInvitesRepo.resolveInvite(ctx, id);
    }

    async createChannelInviteLink(ctx: Context, channelId: number, uid: number) {
        return await this.channelsInvitesRepo.createChannelInviteLink(ctx, channelId, uid);
    }

    async refreshChannelInviteLink(ctx: Context, channelId: number, uid: number) {
        return await this.channelsInvitesRepo.refreshChannelInviteLink(ctx, channelId, uid);
    }

    async createChannelInvite(ctx: Context, channelId: number, uid: number, email: string, emailText?: string, firstName?: string, lastName?: string) {
        return await this.invitesMediator.createChannelInvite(ctx, channelId, uid, email, emailText, firstName, lastName);
    }

    async joinChannelInvite(ctx: Context, uid: number, invite: string) {
        return await this.invitesMediator.joinChannelInvite(ctx, uid, invite);
    }
    async joinAppInvite(ctx: Context, uid: number, invite: string) {
        return await this.invitesMediator.joinAppInvite(ctx, uid, invite);
    }

    async joinOrganizationInvite(ctx: Context, uid: number, invite: string) {
        return await this.invitesMediator.joinOrganizationInvite(ctx, uid, invite);
    }
}
