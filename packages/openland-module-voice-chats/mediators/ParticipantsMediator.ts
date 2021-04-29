import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { lazyInject } from '../../openland-modules/Modules.container';
import { ParticipantsRepository } from '../repositories/ParticipantsRepository';
import { UserError } from '../../openland-errors/UserError';
import { Store } from 'openland-module-db/FDB';
import { AccessDeniedError } from '../../openland-errors/AccessDeniedError';
import { NotFoundError } from '../../openland-errors/NotFoundError';
import { Modules } from '../../openland-modules/Modules';

@injectable()
export class ParticipantsMediator {
    @lazyInject('VoiceChatParticipantsRepository')
    private readonly repo!: ParticipantsRepository;

    /*
    * Listener actions
    * */
    joinChat = async (ctx: Context, cid: number, uid: number, tid: string, role: 'admin' | 'speaker' | 'listener' | null = null) => {
        let res = await this.repo.joinChat(ctx, cid, uid, tid, role);
        let chat = await Store.ConversationVoice.findById(ctx, cid);
        if (!chat) {
            throw new NotFoundError();
        }
        return res;
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
        await this.ensureParticipantIsAdmin(ctx, cid, by);

        let res = await this.repo.promoteParticipant(ctx, cid, uid, by);

        // notify calls
        await Modules.Calls.repo.changeUserPeersRole(ctx, cid, uid, 'speaker');

        return res;
    }
    demoteParticipant = async (ctx: Context, by: number, cid: number, uid: number) => {
        // Allow to demote yourself
        if (by !== uid) {
            await this.ensureParticipantIsAdmin(ctx, cid, by);
        }

        let res = await this.repo.demoteParticipant(ctx, cid, uid);

        // notify calls
        await Modules.Calls.repo.changeUserPeersRole(ctx, cid, uid, 'listener');
        
        return res;
    }
    updateAdminRights = async (ctx: Context, by: number, cid: number, uid: number, isAdmin: boolean) => {
        await this.ensureParticipantIsAdmin(ctx, cid, by);
        if (by === uid) {
            throw new UserError('You cannot update your admin rights yourself');
        }

        return await this.repo.updateAdminRights(ctx, cid, uid, isAdmin);
    }
    kick = async (ctx: Context, by: number, cid: number, uid: number) => {
        await this.ensureParticipantIsAdmin(ctx, cid, by);
        if (by === uid) {
            throw new UserError('You cannot kick yourself');
        }

        return await this.repo.kick(ctx, cid, uid);
    }

    /*
    * Internal tools
    * */
    isAdmin = async (ctx: Context, cid: number, uid: number) => {
        let p = await Store.VoiceChatParticipant.findById(ctx, cid, uid);
        if (!p || p.status !== 'joined' || p.role !== 'admin') {
            return false;
        }
        return true;
    }

    ensureParticipantIsAdmin = async (ctx: Context, cid: number, uid: number) => {
        if (!await this.isAdmin(ctx, cid, uid)) {
            throw new AccessDeniedError();
        }
    }
}