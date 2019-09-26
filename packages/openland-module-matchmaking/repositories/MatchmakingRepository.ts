import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { Store } from '../../openland-module-db/FDB';
import { RandomLayer } from '@openland/foundationdb-random';
import { inTx } from '@openland/foundationdb';
import { UserError } from '../../openland-errors/UserError';
import { NotFoundError } from '../../openland-errors/NotFoundError';
import { GQL } from '../../openland-module-api/schema/SchemaSpec';
import MatchmakingRoomInput = GQL.MatchmakingRoomInput;
import MatchmakingAnswerInput = GQL.MatchmakingAnswerInput;

export type PeerType = 'room';

// export type MatchmakingAnswerInput = { questionId: string } & ({ type: 'text', answer: string } | { type: 'multiselect', tags: string[] });
//
// export type MatchmakingQuestionInput = { id?: string | null, title: string, subtitle?: string | null } & ({ type: 'text' } | { type: 'multiselect', tags: string[] });
//
// export type MatchmakingRoomInput = {
//     enabled: boolean
//     questions: MatchmakingQuestionInput[]
// };

let mapByIds = <Id, T extends { id: Id }>(arr: T[]): Map<Id, T> => {
    return arr.reduce((acc, a) => acc.set(a.id, a), new Map<Id, T>());
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

            if (input.enabled !== null && input.enabled !== undefined) {
                room.enabled = input.enabled;
            }
            if (input.questions) {
                room.questions = input.questions.map(a => a.type === 'Multiselect' ? {
                    id: a.id || this.nextQuestionId(),
                    type: 'multiselect',
                    tags: a.tags!,
                    title: a.title,
                    subtitle: a.subtitle || null
                } : {
                    id: a.id || this.nextQuestionId(),
                    type: 'text',
                    title: a.title,
                    subtitle: a.subtitle || null
                });
            }

            return room;
        });
    }

    fillRoomProfile = async (parent: Context, peerId: number, peerType: PeerType, uid: number, answers: MatchmakingAnswerInput[]) => {
        let room = await this.getRoom(parent, peerId, peerType);
        if (!room.enabled) {
            throw new UserError('Matchmaking is disabled');
        }

        let questions = mapByIds(room.questions);
        let qidSet = new Set<string>();
        for (let ans of answers) {
            // check for question existance
            if (!questions.has(ans.questionId)) {
                throw new NotFoundError('Some of questions are not found');
            }

            // check for duplicates
            if (qidSet.has(ans.questionId)) {
                throw new UserError('Duplicate answer');
            }
            qidSet.add(ans.questionId);

            // check for question type
            let question = questions.get(ans.questionId);
            if (question!.type === 'text' && (ans.tags || !ans.text)) {
                throw new UserError('Text answer cannot contain tags and should contain text');
            }
            if (question!.type === 'multiselect' && (ans.text !== null || !ans.tags)) {
                throw new UserError('Multiselect answer cannot contain text and should contain tags');
            }
        }

        return await inTx(parent, async ctx => {
            let profile = await Store.MatchmakingProfile.findById(ctx, peerId, peerType, uid);
            let answersData = answers.map(a => ({
                type: questions.get(a.questionId)!.type,
                text: a.text as any,
                qid: a.questionId,
                tags: a.tags as any
            }));
            if (!profile) {
                profile = await Store.MatchmakingProfile.create(ctx, peerId, peerType, uid, {
                    answers: answersData,
                });
            } else {
                profile.answers = answersData;
            }
            return profile;
        });
    }

    private nextQuestionId = () => Store.storage.db.get(RandomLayer).nextRandomId();
}
