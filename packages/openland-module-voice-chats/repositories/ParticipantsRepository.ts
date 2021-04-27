import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { Store } from '../../openland-module-db/FDB';
import { VoiceChatParticipant } from '../../openland-module-db/store';
import { NotFoundError } from '../../openland-errors/NotFoundError';
import { lazyInject } from '../../openland-modules/Modules.container';
import { VoiceChatsRepository } from './VoiceChatsRepository';
// import { CallRepository } from '../../openland-module-calls/repositories/CallRepository';
import { VoiceChatEventsRepository } from './VoiceChatEventsRepository';

export type ParticipantStatus = 'left' | 'kicked' | NonNullable<VoiceChatParticipant['role']>;

type ParticipantRoleStatus = { status: VoiceChatParticipant['status'], role: VoiceChatParticipant['role'] };

const Status = {
    isAdmin: (p: ParticipantRoleStatus) => p.status === 'joined' && p.role === 'admin',
    isSpeaker: (p: ParticipantRoleStatus) => p.status === 'joined' && (p.role === 'speaker' || p.role === 'admin'),
    isListener: (p: ParticipantRoleStatus) => p.status === 'joined' && p.role === 'listener',
    isJoined: (p: ParticipantRoleStatus) => p.status === 'joined',
};

export { Status as VoiceChatParticipantStatus };

type MultiListCondition<T> = (item: T) => boolean;
type SubListDeclaration<T> = { name: string, checker: MultiListCondition<T> };

function createListCounter<T>(lists: SubListDeclaration<T>[]) {
    return (prevVal: T, newVal: T) => {
        let operations: { list: string, add: number }[] = [];
        for (let list of lists) {
            if (list.checker(prevVal) && !list.checker(newVal)) {
                operations.push({ list: list.name, add: -1 });
            } else if (!list.checker(prevVal) && list.checker(newVal)) {
                operations.push({ list: list.name, add: 1 });
            } else {
                continue;
            }
        }
        return operations;
    };
}

@injectable()
export class ParticipantsRepository {
    @lazyInject('VoiceChatsRepository')
    private readonly chatsRepo!: VoiceChatsRepository;
    @lazyInject('VoiceChatEventsRepository')
    private readonly events!: VoiceChatEventsRepository;
    // @lazyInject('CallRepository')
    // private readonly calls!: CallRepository;

    private counterCalculator = createListCounter<ParticipantRoleStatus>([
        { name: 'listener', checker: Status.isListener },
        { name: 'speaker', checker: Status.isSpeaker },
        { name: 'admin', checker: Status.isAdmin }
    ]);

    joinChat = async (ctx: Context, cid: number, uid: number, tid: string) => {
        let chat = await this.#getChatOrFail(ctx, cid);

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
            let participant = await this.#getOrFail(ctx, cid, uid);
            let targetRole = participant.role || 'listener';
            await this.#changeStatus(ctx, cid, uid, targetRole);
        }

        await this.events.postParticipantUpdated(ctx, cid, uid, chat.isPrivate || false);

        return p;
    }

    updateHandRaised = async (ctx: Context, cid: number, uid: number, handRaised: boolean) => {
        let chat = await this.#getChatOrFail(ctx, cid);

        let participant = await this.#getOrFail(ctx, cid, uid);
        if (!Status.isListener(participant)) {
            return participant;
        }
        participant.handRaised = handRaised;

        await this.events.postParticipantUpdated(ctx, cid, uid, chat.isPrivate || false);
        return participant;
    }

    leaveChat = async (ctx: Context, cid: number, uid: number) => {
        let chat = await this.#getChatOrFail(ctx, cid);

        await this.#changeStatus(ctx, cid, uid, 'left');

        if (await this.#counter(cid, 'admin').get(ctx) === 0) {
            await this.chatsRepo.setChatActive(ctx, cid, false);
        }

        await this.events.postParticipantUpdated(ctx, cid, uid, chat.isPrivate || false);
    }

    promoteParticipant = async (ctx: Context, cid: number, uid: number, by: number) => {
        let chat = await this.#getChatOrFail(ctx, cid);
        let participant = await this.#getOrFail(ctx, cid, uid);
        if (!Status.isListener(participant) && participant.handRaised) {
            throw new Error('You can promote only listeners who raised hand');
        }

        await this.#changeStatus(ctx, cid, uid, 'speaker');
        participant.promotedBy = by;
        participant.handRaised = false;

        await this.events.postParticipantUpdated(ctx, cid, uid, chat.isPrivate || false);
    }

    demoteParticipant = async (ctx: Context, cid: number, uid: number) => {
        let chat = await this.#getChatOrFail(ctx, cid);
        let participant = await this.#getOrFail(ctx, cid, uid);
        if (!Status.isSpeaker(participant)) {
            throw new Error('You can demote only current speakers');
        }

        await this.#changeStatus(ctx, cid, uid, 'listener');
        participant.promotedBy = null;
        participant.handRaised = false;

        await this.events.postParticipantUpdated(ctx, cid, uid, chat.isPrivate || false);
    }

    updateAdminRights = async (ctx: Context, cid: number, uid: number, isAdmin: boolean) => {
        let chat = await this.#getChatOrFail(ctx, cid);
        let participant = await this.#getOrFail(ctx, cid, uid);
        if (!Status.isSpeaker(participant)) {
            throw new Error('Only speaker can be an admin');
        }
        await this.#changeStatus(ctx, cid, uid, isAdmin ? 'admin' : 'speaker');
        await this.events.postParticipantUpdated(ctx, cid, uid, chat.isPrivate || false);
    }

    kick = async (ctx: Context, cid: number, uid: number) => {
        let chat = await this.#getChatOrFail(ctx, cid);
        await this.#changeStatus(ctx, cid, uid, 'kicked');
        await this.events.postParticipantUpdated(ctx, cid, uid, chat.isPrivate || false);
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

        let newStatus: VoiceChatParticipant['status'] = 'joined';
        let newRole: VoiceChatParticipant['role'] = participant.role;

        if (status !== 'left' && status !== 'kicked') {
            newStatus = 'joined';
            newRole = status;
        } else if (status === 'left') {
            newStatus = 'left';
        } else if (status === 'kicked') {
            newStatus = 'kicked';
            newRole = null;
        }
        let newStatusRole = { status: newStatus, role: newRole };

        let operations = this.counterCalculator(participant, newStatusRole);

        // Update counters
        for (let op of operations) {
            this.#counter(cid, op.list as 'admin' | 'speaker' | 'listener').add(ctx, op.add);
        }

        // Update atomic with current active chat
        if (Status.isJoined(newStatusRole)) {
            let prevChat = await Store.VoiceChatParticipantActive.byId(uid).get(ctx);
            if (prevChat !== 0 && prevChat !== cid) {
                await this.leaveChat(ctx, prevChat, uid);
            }
            Store.VoiceChatParticipantActive.byId(uid).set(ctx, cid);
        } else {
            Store.VoiceChatParticipantActive.byId(uid).set(ctx, 0);
        }

        // Update media streams if ability to speak changed
        // if (Status.isSpeaker(newStatusRole) !== Status.isSpeaker(participant) && participant.tid) {
        //     let peer = await Store.ConferencePeer.auth.find(ctx, cid, uid, participant.tid);
        //     if (peer) {
        //         await this.calls.updateMediaStreams(ctx, cid, uid, participant.tid);
        //     }
        // }

        participant.status = newStatus;
        participant.role = newRole;

        await participant.flush(ctx);
    }

    #getOrFail = async (ctx: Context, cid: number, uid: number) => {
        let participant = await Store.VoiceChatParticipant.findById(ctx, cid, uid);
        if (!participant) {
            throw new NotFoundError();
        }
        return participant;
    }

    #getChatOrFail = async (ctx: Context, cid: number) => {
        let chat = await Store.ConversationVoice.findById(ctx, cid);
        if (!chat) {
            throw new NotFoundError();
        }
        return chat;
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