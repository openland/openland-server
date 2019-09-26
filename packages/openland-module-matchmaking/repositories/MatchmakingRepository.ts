import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { Store } from '../../openland-module-db/FDB';
import { RandomLayer } from '@openland/foundationdb-random';
import { inTx } from '@openland/foundationdb';
import { UserError } from '../../openland-errors/UserError';
import { NotFoundError } from '../../openland-errors/NotFoundError';

export type PeerType = 'room';

export type MatchmakingAnswerInput = { questionId: string } & ({ type: 'text', answer: string } | { type: 'multiselect', tags: string[] });

export type MatchmakingQuestionInput = { id?: string | null, title: string, subtitle?: string | null } & ({ type: 'text' } | { type: 'multiselect', tags: string[] });

export type MatchmakingRoomInput = {
    enabled: boolean
    questions: MatchmakingQuestionInput[]
};

@injectable()
export class MatchmakingRepository {
    getRoom = async (ctx: Context, peerId: number, peerType: PeerType) => {
        let room = await Store.MatchmakingRoom.findById(ctx, peerId, peerType);
        if (!room) {
            room = await Store.MatchmakingRoom.create(ctx, peerId, peerType, {
                enabled: false,
                questions: [{
                    type: 'text' as any,
                    id: this.nextQuestionId(),
                    title: 'Interested in',
                    subtitle: '',
                }, {
                    type: 'text' as any,
                    id: this.nextQuestionId(),
                    title: 'Looking for',
                    subtitle: '',
                }],
            });
        }
        return room;
    }

    getRoomProfiles = async (ctx: Context, peerId: number, peerType: PeerType) => {
        return await Store.MatchmakingProfile.room.findAll(ctx, peerId, peerType);
    }

    getRoomProfile = async (ctx: Context, peerId: number, peerType: PeerType, uid: number) => {
        return await Store.MatchmakingProfile.findById(ctx, peerId, peerType, uid);
    }

    saveRoom = async (parent: Context, peerId: number, peerType: PeerType, input: MatchmakingRoomInput) => {
        return await inTx(parent, async ctx => {
            let room = await this.getRoom(ctx, peerId, peerType);

            room.enabled = input.enabled;
            room.questions = input.questions.map(a => a.type === 'multiselect' ? {
                id: a.id || this.nextQuestionId(),
                type: 'multiselect',
                tags: a.tags,
                title: a.title,
                subtitle: a.subtitle || null
            } : {
                id: a.id || this.nextQuestionId(),
                type: 'text',
                title: a.title,
                subtitle: a.subtitle || null
            });

            return room;
        });
    }

    fillRoomProfile = async (parent: Context, peerId: number, peerType: PeerType, uid: number, answers: MatchmakingAnswerInput[]) => {
        let room = await this.getRoom(parent, peerId, peerType);
        if (!room.enabled) {
            throw new UserError('Matchmaking is disabled');
        }
        // check for question existance
        let qids = room.questions.map(a => a.id);
        if (!answers.every(a => qids.includes(a.questionId))) {
            throw new NotFoundError('Some of questions are not found');
        }

        // check for duplicates
        let qidSet = new Set<string>();
        for (let ans of answers) {
            if (qidSet.has(ans.questionId)) {
                throw new UserError('Duplicate answer');
            }
            qidSet.add(ans.questionId);
        }

        return await inTx(parent, async ctx => {
            let profile = await Store.MatchmakingProfile.findById(ctx, peerId, peerType, uid);
            if (!profile) {
                await Store.MatchmakingProfile.create(ctx, peerId, peerType, uid, {
                    answers: answers.map(a => ({
                        type: a.type as any,
                        text: '',
                        qid: a.questionId,
                        tags: a.type === 'multiselect' ? a.tags : undefined,
                    })),
                });
            }
            return profile;
        });
    }

    private nextQuestionId = () => Store.storage.db.get(RandomLayer).nextRandomId();
}
