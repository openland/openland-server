import { injectable, inject } from 'inversify';
import { InvitesMediator } from './mediators/InvitesMediator';
import { InvitesRoomRepository } from './repositories/InvitesRoomRepository';
import { InvitesOrganizationRepository } from './repositories/InvitesOrganizationRepository';
import { Context } from '@openland/context';
import { invitesIndexer } from './workers/invitesIndexer';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';

@injectable()
export class InvitesModule {
    readonly roomInvitesRepo: InvitesRoomRepository;
    readonly invitesMediator: InvitesMediator;
    readonly orgInvitesRepo: InvitesOrganizationRepository;

    constructor(
        @inject('InvitesRoomRepository') channelsInvitesRepo: InvitesRoomRepository,
        @inject('InvitesMediator') channelsInvitesMediator: InvitesMediator,
        @inject('InvitesOrganizationRepository') orgInvitesRepo: InvitesOrganizationRepository,
    ) {
        this.roomInvitesRepo = channelsInvitesRepo;
        this.invitesMediator = channelsInvitesMediator;
        this.orgInvitesRepo = orgInvitesRepo;
    }

    start = async () => {
        if (serverRoleEnabled('workers')) {
            invitesIndexer();
        }
    }

    async getInviteLinkKey(ctx: Context, uid: number) {
        return this.orgInvitesRepo.getAppInviteLinkKey(ctx, uid);
    }

    //
    // Channels
    //

    async resolveInvite(ctx: Context, id: string) {
        return await this.roomInvitesRepo.resolveInvite(ctx, id);
    }

    async createRoomlInviteLink(ctx: Context, channelId: number, uid: number) {
        return await this.roomInvitesRepo.createRoomInviteLink(ctx, channelId, uid);
    }

    async refreshRoomInviteLink(ctx: Context, channelId: number, uid: number) {
        return await this.roomInvitesRepo.refreshRoomInviteLink(ctx, channelId, uid);
    }

    async createRoomInvite(ctx: Context, channelId: number, uid: number, email: string, emailText?: string, firstName?: string, lastName?: string) {
        return await this.invitesMediator.createRoomInvite(ctx, channelId, uid, email, emailText, firstName, lastName);
    }

    async joinRoomInvite(ctx: Context, uid: number, invite: string, isNewUser: boolean) {
        return await this.invitesMediator.joinRoomInvite(ctx, uid, invite, isNewUser);
    }

    async joinAppInvite(ctx: Context, uid: number, invite: string, isNewUser: boolean) {
        return await this.invitesMediator.joinAppInvite(ctx, uid, invite, isNewUser);
    }

    async createOrganizationInvite(ctx: Context, oid: number, uid: number, inviteReq: { email: string; emailText?: string, firstName?: string; lastName?: string }) {
        return await this.invitesMediator.createOrganizationInvite(ctx, oid, uid, inviteReq);
    }

    async joinOrganizationInvite(ctx: Context, uid: number, invite: string, isNewUser: boolean) {
        return await this.invitesMediator.joinOrganizationInvite(ctx, uid, invite, isNewUser);

    }
}
