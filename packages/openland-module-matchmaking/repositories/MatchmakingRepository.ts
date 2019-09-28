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
import { Modules } from 'openland-modules/Modules';
import { MatchmakingProfile } from '../../openland-module-db/store';

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
                    type: 'multiselect' as any,
                    id: this.nextQuestionId(),
                    title: 'Interested in',
                    subtitle: '',
                    tags: [
                        'Founder', 'Engineer', 'Investor',
                        'Product manager', 'Recruiter',
                        'Marketing and sales', 'Another'
                    ]
                }, {
                    type: 'text' as any,
                    id: this.nextQuestionId(),
                    title: 'Looking for',
                    subtitle: '',
                }, {
                    type: 'text' as any,
                    id: this.nextQuestionId(),
                    title: 'Can help with',
                    subtitle: ''
                }],
            });
        }
        return room;
    }

    getRoomProfiles = async (ctx: Context, peerId: number, peerType: PeerType, uid?: number) => {
        let profiles = await Store.MatchmakingProfile.room.findAll(ctx, peerId, peerType);
        if (uid) {
            let myProfile = await Store.MatchmakingProfile.findById(ctx, peerId, peerType, uid);
            if (!myProfile) {
                return profiles;
            }

            let findIntersectionScore = (arr1: string[] | undefined, arr2: string[]) => {
                if (!arr1) {
                    return 0;
                }
                return arr1.reduce((acc, a) => arr2.find(b => b === a) ? acc + 1 : acc, 0);
            };
            let myAnswers = myProfile.answers
                .reduce((acc, a) => a.type === 'multiselect' ? acc.set(a.question.id, a.tags) : acc, new Map<string, string[]>());
            let scoreProfile = (profile: MatchmakingProfile) => {
                return profile.answers
                    .reduce((acc, b) => b.type === 'multiselect' ?  (acc + findIntersectionScore(myAnswers.get(b.question.id), b.tags)) : acc, 0);
            };
            profiles = profiles.sort((a, b) => scoreProfile(b) - scoreProfile(a));
        }
        return profiles;
    }

    getRoomProfile = async (ctx: Context, peerId: number, peerType: PeerType, uid: number) => {
        return await Store.MatchmakingProfile.findById(ctx, peerId, peerType, uid);
    }

    saveRoom = async (parent: Context, peerId: number, peerType: PeerType, uid: number, input: MatchmakingRoomInput) => {
        return await inTx(parent, async ctx => {
            if (peerType === 'room') {
                await Modules.Messaging.room.checkCanEditChat(ctx, peerId, uid);
            }

            let room = await this.getRoom(ctx, peerId, peerType);

            if (input.enabled !== null && input.enabled !== undefined) {
                room.enabled = input.enabled;
            }
            let existingQuestions = mapByIds(room.questions);
            if (input.questions) {
                room.questions = input.questions.map(a => {
                    if (a.id && existingQuestions.has(a.id)) {
                        return existingQuestions.get(a.id)!;
                    }
                    return a.type === 'Multiselect' ? {
                        id: this.nextQuestionId(),
                        type: 'multiselect',
                        tags: a.tags!,
                        title: a.title,
                        subtitle: a.subtitle || null,
                    } : {
                        id: this.nextQuestionId(),
                        type: 'text',
                        title: a.title,
                        subtitle: a.subtitle || null,
                    };
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
        if (peerType === 'room') {
            await Modules.Messaging.room.checkCanUserSeeChat(parent, uid, peerId);
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
            if (question!.type === 'text' && !ans.text) {
                throw new UserError('Text answer should contain text');
            }
            if (question!.type === 'multiselect' && !ans.tags) {
                throw new UserError('Multiselect answer should contain tags');
            }
        }

        return await inTx(parent, async ctx => {
            let profile = await Store.MatchmakingProfile.findById(ctx, peerId, peerType, uid);
            let answersData = answers.map(a => ({
                type: questions.get(a.questionId)!.type,
                question: questions.get(a.questionId)!,
                text: a.text as any,
                tags: a.tags as any,
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
