import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { Store } from '../../openland-module-db/FDB';
import { VoiceChatParticipantShape } from '../../openland-module-db/store';
import { NotFoundError } from '../../openland-errors/NotFoundError';
import { lazyInject } from '../../openland-modules/Modules.container';
import { VoiceChatsRepository } from './VoiceChatsRepository';
import { VoiceChatEventsMediator } from '../mediators/VoiceChatEventsMediator';
import { CallRepository } from '../../openland-module-calls/repositories/CallRepository';

export type ParticipantStatus = VoiceChatParticipantShape['status'];

const Status = {
    isAdmin: (p: ParticipantStatus) => p === 'admin',
    isSpeaker: (p: ParticipantStatus) => p === 'admin' || p === 'speaker',
    isListener: (p: ParticipantStatus) => p === 'listener',
    isJoined: (p: ParticipantStatus) => p !== 'kicked' && p !== 'left',
};
export { Status as VoiceChatParticipantStatus };

@injectable()
export class ParticipantsRepository {
    @lazyInject('VoiceChatsRepository')
    private readonly chatsRepo!: VoiceChatsRepository;
    @lazyInject('VoiceChatEventsMediator')
    private readonly events!: VoiceChatEventsMediator;
    @lazyInject('CallRepository')
    private readonly calls!: CallRepository;

    joinChat = async (ctx: Context, cid: number, uid: number, tid: string) => {
        let chat = await Store.ConversationVoice.findById(ctx, cid);
        if (!chat) {
            throw new NotFoundError();
        }
        if (!chat.active) {
            await this.chatsRepo.setChatActive(ctx, cid, true);
        }

        let p = await this.#getOrCreateParticipant(ctx, cid, uid, tid);
        if (Status.isJoined(p.status)) {
            return p;
        }

        if (await this.#counter(cid, 'admin').get(ctx) === 0) {
            await this.#changeStatus(ctx, cid, uid, 'admin');
        } else {
            await this.#changeStatus(ctx, cid, uid, 'speaker');
        }

        await this.events.postParticipantUpdated(ctx, cid, uid);

        return p;
    }

    updateHandRaised = async (ctx: Context, cid: number, uid: number, handRaised: boolean) => {
        let participant = await this.#getOrFail(ctx, cid, uid);
        if (!Status.isListener(participant.status)) {
            throw new Error('You cannot raise hand if you are not listener');
        }
        participant.handRaised = handRaised;

        await this.events.postParticipantUpdated(ctx, cid, uid);
        return participant;
    }

    leaveChat = async (ctx: Context, cid: number, uid: number) => {
        await this.#changeStatus(ctx, cid, uid, 'left');

        if (await this.#counter(cid, 'admin').get(ctx) === 0) {
            await this.chatsRepo.setChatActive(ctx, cid, false);
        }

        await this.events.postParticipantUpdated(ctx, cid, uid);
    }

    promoteParticipant = async (ctx: Context, cid: number, uid: number, by: number) => {
        let participant = await this.#getOrFail(ctx, cid, uid);
        if (!Status.isListener(participant.status) && participant.handRaised) {
            throw new Error('You can promote only listeners who raised hand');
        }

        await this.#changeStatus(ctx, cid, uid, 'speaker');
        participant.promotedBy = by;
        participant.handRaised = false;

        await this.events.postParticipantUpdated(ctx, cid, uid);
    }

    demoteParticipant = async (ctx: Context, cid: number, uid: number) => {
        let participant = await this.#getOrFail(ctx, cid, uid);
        if (!Status.isSpeaker(participant.status)) {
            throw new Error('You can demote only current speakers');
        }

        await this.#changeStatus(ctx, cid, uid, 'listener');
        participant.promotedBy = null;
        participant.handRaised = false;

        await this.events.postParticipantUpdated(ctx, cid, uid);
    }

    updateAdminRights = async (ctx: Context, cid: number, uid: number, isAdmin: boolean) => {
        let participant = await this.#getOrFail(ctx, cid, uid);
        if (!Status.isSpeaker(participant.status)) {
            throw new Error('Only speaker can be an admin');
        }
        await this.#changeStatus(ctx, cid, uid, isAdmin ? 'admin' : 'speaker');
        await this.events.postParticipantUpdated(ctx, cid, uid);
    }

    kick = async (ctx: Context, cid: number, uid: number) => {
        await this.#changeStatus(ctx, cid, uid, 'kicked');
        await this.events.postParticipantUpdated(ctx, cid, uid);
    }

    #counter = (cid: number, status: 'admin' | 'speaker' | 'listener') => {
        return Store.VoiceChatParticipantCounter.byId(cid, status);
    }

    #changeStatus = async (ctx: Context, cid: number, uid: number, status: ParticipantStatus) => {
        let participant = await this.#getOrFail(ctx, cid, uid);
        if (participant.status === status) {
            return;
        }

        // If was listener and now not listener
        if (Status.isListener(participant.status) && !Status.isListener(status)) {
            this.#counter(cid, 'listener').decrement(ctx);
        }
        // If was not listener and now listener
        if (!Status.isListener(participant.status) && Status.isListener(status)) {
            this.#counter(cid, 'listener').increment(ctx);
        }
        // If was speaker and now not speaker
        if (Status.isSpeaker(participant.status) && !Status.isSpeaker(status)) {
            this.#counter(cid, 'speaker').decrement(ctx);
        }
        // If was not speaker and now speaker
        if (!Status.isSpeaker(participant.status) && Status.isSpeaker(status)) {
            this.#counter(cid, 'speaker').increment(ctx);
        }
        // If was admin and now not admin
        if (Status.isAdmin(participant.status) && !Status.isAdmin(status)) {
            this.#counter(cid, 'admin').decrement(ctx);
        }
        // If was not admin and now admin
        if (!Status.isAdmin(participant.status) && Status.isAdmin(status)) {
            this.#counter(cid, 'admin').increment(ctx);
        }

        // Update atomic with current active chat
        if (Status.isJoined(status)) {
            let prevChat = await Store.VoiceChatParticipantActive.byId(uid).get(ctx);
            if (prevChat !== 0 && prevChat !== cid) {
                await this.leaveChat(ctx, prevChat, uid);
            }
            Store.VoiceChatParticipantActive.byId(uid).set(ctx, cid);
        } else {
            Store.VoiceChatParticipantActive.byId(uid).set(ctx, 0);
        }

        // Update media streams if ability to speak changed
        if (Status.isSpeaker(status) !== Status.isSpeaker(participant.status) && participant.tid) {
            let peer = await Store.ConferencePeer.auth.find(ctx, cid, uid, participant.tid);
            if (peer) {
                await this.calls.updateMediaStreams(ctx, cid, uid, participant.tid);
            }
        }

        participant.status = status;
        await participant.flush(ctx);
    }

    #getOrFail = async (ctx: Context, cid: number, uid: number) => {
        let participant = await Store.VoiceChatParticipant.findById(ctx, cid, uid);
        if (!participant) {
            throw new NotFoundError();
        }
        return participant;
    }

    #getOrCreateParticipant = async (ctx: Context, cid: number, uid: number, tid: string) => {
        let participant = await Store.VoiceChatParticipant.findById(ctx, cid, uid);
        if (participant) {
            return participant;
        }
        return await Store.VoiceChatParticipant.create(ctx, cid, uid, {
            status: 'left',
            handRaised: false,
            promotedBy: null,
            tid: tid
        });
    }
}