import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { lazyInject } from '../../openland-modules/Modules.container';
import { ParticipantsRepository, ParticipantStatus } from '../repositories/ParticipantsRepository';
import { UserError } from '../../openland-errors/UserError';
import { Store } from 'openland-module-db/FDB';
import { AccessDeniedError } from '../../openland-errors/AccessDeniedError';

@injectable()
export class ParticipantsMediator {
    @lazyInject('VoiceChatParticipantsRepository')
    private readonly repo!: ParticipantsRepository;

    /*
    * Listener actions
    * */
    joinChat = async (ctx: Context, cid: number, uid: number, status: ParticipantStatus = 'listener') => {
        return await this.repo.createParticipant(ctx, cid, uid, status);
    }
    updateHandRaised = async (ctx: Context, cid: number, uid: number, handRaised: boolean) => {
        return await this.repo.updateHandRaised(ctx, cid, uid, handRaised);
    }
    leaveChat = async (ctx: Context, cid: number, uid: number) => {
        return await this.repo.leaveChat(ctx, cid, uid);
    }

    /*
    * Admin actions
    * */
    promoteParticipant = async (ctx: Context, by: number, cid: number, uid: number) => {
        await this.#ensureParticipantIsAdmin(ctx, cid, by);

        return await this.repo.promoteParticipant(ctx, cid, uid, by);
    }
    updateAdminRights = async (ctx: Context, by: number, cid: number, uid: number, isAdmin: boolean) => {
        await this.#ensureParticipantIsAdmin(ctx, cid, by);

        if (by === uid) {
            throw new UserError('You cannot update your admin rights yourself');
        }
        return await this.repo.updateAdminRights(ctx, cid, uid, isAdmin);
    }
    kick = async (ctx: Context, by: number, cid: number, uid: number) => {
        await this.#ensureParticipantIsAdmin(ctx, cid, by);

        return await this.repo.kick(ctx, cid, uid);
    }

    #ensureParticipantIsAdmin = async (ctx: Context, cid: number, uid: number) => {
        let p = await Store.VoiceChatParticipant.findById(ctx, cid, uid);
        if (!p || p.status !== 'admin') {
            throw new AccessDeniedError();
        }
    }
}