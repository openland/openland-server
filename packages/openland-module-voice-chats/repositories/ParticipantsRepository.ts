import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { Store } from '../../openland-module-db/FDB';
import { VoiceChatParticipantShape } from '../../openland-module-db/store';
import { NotFoundError } from '../../openland-errors/NotFoundError';

export type ParticipantStatus = VoiceChatParticipantShape['status'];

const Status = {
    isAdmin: (p: ParticipantStatus) => p === 'admin',
    isSpeaker: (p: ParticipantStatus) => p === 'admin' || p === 'speaker',
    isListener: (p: ParticipantStatus) => p === 'listener',
};

@injectable()
export class ParticipantsRepository {
    #listenersCounter = (cid: number) => Store.VoiceChatParticipantCounter.byId(cid, 'listener');
    #speakersCounter = (cid: number) => Store.VoiceChatParticipantCounter.byId(cid, 'speaker');
    #adminsCounter = (cid: number) => Store.VoiceChatParticipantCounter.byId(cid, 'admin');

    createParticipant = async (ctx: Context, cid: number, uid: number, status: ParticipantStatus) => {
        let participant = await Store.VoiceChatParticipant.create(ctx, cid, uid, {
            status,
            handRaised: false,
            promotedBy: null,
        });
        if (Status.isListener(status)) {
            await this.#listenersCounter(cid).increment(ctx);
        }
        if (Status.isSpeaker(status)) {
            await this.#speakersCounter(cid).increment(ctx);
        }
        if (Status.isAdmin(status)) {
            await this.#adminsCounter(cid).increment(ctx);
        }

        return participant;
    }

    updateHandRaised = async (ctx: Context, cid: number, uid: number, handRaised: boolean) => {
        let participant = await this.#getOrFail(ctx, cid, uid);
        if (!Status.isListener(participant.status)) {
            throw new Error('You cannot raise hand if you are not listener');
        }
        participant.handRaised = handRaised;
        return participant;
    }

    leaveChat = async (ctx: Context, cid: number, uid: number) => {
        await this.#changeStatus(ctx, cid, uid, 'left');
    }

    promoteParticipant = async (ctx: Context, cid: number, uid: number, by: number) => {
        let participant = await this.#getOrFail(ctx, cid, uid);
        if (!Status.isListener(participant.status) && participant.handRaised) {
            throw new Error('You can promote only listeners who raised hand');
        }

        await this.#changeStatus(ctx, cid, uid, 'speaker');
        participant.promotedBy = by;
        participant.handRaised = false;
    }

    demoteParticipant = async (ctx: Context, cid: number, uid: number, by: number) => {
        let participant = await this.#getOrFail(ctx, cid, uid);
        if (!Status.isSpeaker(participant.status)) {
            throw new Error('You can demote only current speakers');
        }

        await this.#changeStatus(ctx, cid, uid, 'listener');
        participant.promotedBy = null;
        participant.handRaised = false;
    }

    updateAdminRights = async (ctx: Context, cid: number, uid: number, isAdmin: boolean) => {
        let participant = await this.#getOrFail(ctx, cid, uid);
        if (!Status.isSpeaker(participant.status)) {
            throw new Error('Only speaker can be an admin');
        }
        await this.#changeStatus(ctx, cid, uid, isAdmin ? 'admin' : 'speaker');
    }

    kick = async (ctx: Context, cid: number, uid: number) => {
        await this.#changeStatus(ctx, cid, uid, 'kicked');
    }

    #getOrFail = async (ctx: Context, cid: number, uid: number) => {
        let participant = await Store.VoiceChatParticipant.findById(ctx, cid, uid);
        if (!participant) {
            throw new NotFoundError();
        }
        return participant;
    }

    #changeStatus = async (ctx: Context, cid: number, uid: number, status: ParticipantStatus) => {
        let participant = await this.#getOrFail(ctx, cid, uid);
        if (participant.status === status) {
            return;
        }

        // If was listener and now not listener
        if (Status.isListener(participant.status) && !Status.isListener(status)) {
            await this.#listenersCounter(cid).decrement(ctx);
        }
        // If was not listener and now listener
        if (!Status.isListener(participant.status) && Status.isListener(status)) {
            await this.#listenersCounter(cid).increment(ctx);
        }
        // If was speaker and now not speaker
        if (Status.isSpeaker(participant.status) && !Status.isSpeaker(status)) {
            await this.#speakersCounter(cid).decrement(ctx);
        }
        // If was not speaker and now speaker
        if (!Status.isSpeaker(participant.status) && Status.isSpeaker(status)) {
            await this.#speakersCounter(cid).increment(ctx);
        }
        // If was admin and now not admin
        if (Status.isAdmin(participant.status) && !Status.isAdmin(status)) {
            await this.#adminsCounter(cid).decrement(ctx);
        }
        // If was not admin and now admin
        if (!Status.isAdmin(participant.status) && Status.isAdmin(status)) {
            await this.#adminsCounter(cid).increment(ctx);
        }

        participant.status = status;
    }
}