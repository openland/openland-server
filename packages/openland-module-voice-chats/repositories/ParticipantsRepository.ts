import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { Store } from '../../openland-module-db/FDB';
import { VoiceChatParticipant } from '../../openland-module-db/store';
import { NotFoundError } from '../../openland-errors/NotFoundError';
import { lazyInject } from '../../openland-modules/Modules.container';
import { VoiceChatsRepository } from './VoiceChatsRepository';
import { CallRepository } from '../../openland-module-calls/repositories/CallRepository';
import { VoiceChatEventsRepository } from './VoiceChatEventsRepository';

export type ParticipantStatus = 'left' | 'kicked' | NonNullable<VoiceChatParticipant['role']>;

const statusChecker = (f: (p: ParticipantStatus | 'unassigned') => boolean) => (opts: ParticipantStatus | VoiceChatParticipant) => {
    if (typeof opts === 'string') {
        return f(opts);
    }
    if (opts.role === null) {
        return f(opts.status === 'joined' ? 'unassigned' : opts.status);
    }
    return f(opts.status === 'joined' ? opts.role : opts.status);
};

const Status = {
    isAdmin: statusChecker((p) => p === 'admin'),
    isSpeaker: statusChecker((p) => p === 'admin' || p === 'speaker'),
    isListener: statusChecker((p) => p === 'listener'),
    isJoined: statusChecker((p) => p !== 'kicked' && p !== 'left'),
};
export { Status as VoiceChatParticipantStatus };

@injectable()
export class ParticipantsRepository {
    @lazyInject('VoiceChatsRepository')
    private readonly chatsRepo!: VoiceChatsRepository;
    @lazyInject('VoiceChatEventsRepository')
    private readonly events!: VoiceChatEventsRepository;
    @lazyInject('CallRepository')
    private readonly calls!: CallRepository;

    joinChat = async (ctx: Context, cid: number, uid: number, tid: string) => {
        let chat = await Store.ConversationVoice.findById(ctx, cid);
        if (!chat) {
            throw new NotFoundError();
        }

        let p = await this.#getOrCreateParticipant(ctx, cid, uid, tid);
        if (p.status === 'joined') {
            return p;
        }

        if (!chat.active) {
            await this.chatsRepo.setChatActive(ctx, cid, true);
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
        if (!Status.isListener(participant)) {
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
        if (!Status.isListener(participant) && participant.handRaised) {
            throw new Error('You can promote only listeners who raised hand');
        }

        await this.#changeStatus(ctx, cid, uid, 'speaker');
        participant.promotedBy = by;
        participant.handRaised = false;

        await this.events.postParticipantUpdated(ctx, cid, uid);
    }

    demoteParticipant = async (ctx: Context, cid: number, uid: number) => {
        let participant = await this.#getOrFail(ctx, cid, uid);
        if (!Status.isSpeaker(participant)) {
            throw new Error('You can demote only current speakers');
        }

        await this.#changeStatus(ctx, cid, uid, 'listener');
        participant.promotedBy = null;
        participant.handRaised = false;

        await this.events.postParticipantUpdated(ctx, cid, uid);
    }

    updateAdminRights = async (ctx: Context, cid: number, uid: number, isAdmin: boolean) => {
        let participant = await this.#getOrFail(ctx, cid, uid);
        if (!Status.isSpeaker(participant)) {
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
        if ((status === 'left' || status === 'kicked') && participant.status === status) {
            return;
        }
        if (participant.role === status && participant.status === 'joined') {
            return;
        }

        // If was listener and now not listener
        if (Status.isListener(participant) && !Status.isListener(status)) {
            this.#counter(cid, 'listener').decrement(ctx);
        }
        // If was not listener and now listener
        if (!Status.isListener(participant) && Status.isListener(status)) {
            this.#counter(cid, 'listener').increment(ctx);
        }
        // If was speaker and now not speaker
        if (Status.isSpeaker(participant) && !Status.isSpeaker(status)) {
            this.#counter(cid, 'speaker').decrement(ctx);
        }
        // If was not speaker and now speaker
        if (!Status.isSpeaker(participant) && Status.isSpeaker(status)) {
            this.#counter(cid, 'speaker').increment(ctx);
        }
        // If was admin and now not admin
        if (Status.isAdmin(participant) && !Status.isAdmin(status)) {
            this.#counter(cid, 'admin').decrement(ctx);
        }
        // If was not admin and now admin
        if (!Status.isAdmin(participant) && Status.isAdmin(status)) {
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
        if (Status.isSpeaker(status) !== Status.isSpeaker(participant) && participant.tid) {
            let peer = await Store.ConferencePeer.auth.find(ctx, cid, uid, participant.tid);
            if (peer) {
                await this.calls.updateMediaStreams(ctx, cid, uid, participant.tid);
            }
        }

        if (status !== 'left' && status !== 'kicked') {
            participant.status = 'joined';
            participant.role = status;
        } else if (status === 'left') {
            participant.status = 'left';
        } else if (status === 'kicked') {
            participant.status = 'kicked';
            participant.role = null;
        }
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
            role: null,
            handRaised: false,
            promotedBy: null,
            tid: tid
        });
    }
}