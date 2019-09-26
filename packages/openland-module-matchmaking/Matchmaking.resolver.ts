import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { IDs, IdsFactory } from '../openland-module-api/IDs';
import { GQLRoots } from '../openland-module-api/schema/SchemaRoots';
import MatchmakingAnswerRoot = GQLRoots.MatchmakingAnswerRoot;
import MatchmakingQuestionRoot = GQLRoots.MatchmakingQuestionRoot;
import { Modules } from 'openland-modules/Modules';
import { AuthContext } from '../openland-module-auth/AuthContext';
import { withUser } from 'openland-module-api/Resolvers';
import { PeerType } from './repositories/MatchmakingRepository';

let resolvePeer = (id: string): { id: number, type: PeerType } | null => {
    let idMeta = IdsFactory.resolve(id);
    if (idMeta.type.typeName === 'Conversation') {
        return { id: idMeta.id.valueOf() as number, type: 'room' };
    }
    return null;
};

export default {
    MatchmakingRoom: {
        enabled: src => src.enabled,
        myProfile:  async (src, _, ctx) => {
            let auth = AuthContext.get(ctx);
            if (!auth.uid) {
                return null;
            }
            return await Modules.Matchmaking.getRoomProfile(ctx, src.peerId, src.peerType as any, auth.uid);
        },
        profiles: async (src, _, ctx) => await Modules.Matchmaking.getRoomProfiles(ctx, src.peerId, src.peerType as any),
        questions: src => src.questions,
    },
    MatchmakingProfile: {
        answers: async (root, _, ctx) => {
            let room = await Modules.Matchmaking.getRoom(ctx, root.peerId, root.peerType as any);
            return root.answers
                .map(a => ({
                    ...a, question: room.questions.find(b => b.id === a.qid),
                }));
        },
        user: root => root.uid,
    },
    MatchmakingAnswer: {
        __resolveType(obj: MatchmakingAnswerRoot) {
            if (obj.type === 'multiselect') {
                return 'MultiselectMatchmakingAnswer';
            }
            if (obj.type === 'text') {
                return 'TextMatchmakingAnswer';
            }

            throw new Error('Unknown question type');
        },
    },
    MultiselectMatchmakingAnswer: {
        question: root => root.question,
        tags: root => root.tags,
    },
    TextMatchmakingAnswer: {
        question: root => root.question,
        answer: root => root.text,
    },
    MatchmakingQuestion: {
        __resolveType(obj: MatchmakingQuestionRoot) {
            if (obj.type === 'multiselect') {
                return 'MultiselectMatchmakingQuestion';
            }
            if (obj.type === 'text') {
                return 'TextMatchmakingQuestion';
            }

            throw new Error('Unknown question type');
        }
    },
    MultiselectMatchmakingQuestion: {
        id: src => IDs.MatchmakingQuestion.serialize(src.id),
        title: src => src.title,
        subtitle: src => src.subtitle,
        tags: src => src.tags,
    },
    TextMatchmakingQuestion: {
        id: src => IDs.MatchmakingQuestion.serialize(src.id),
        title: src => src.title,
        subtitle: src => src.subtitle,
    },
    Query: {
        matchmakingRoom: withUser(async (ctx, args) => {
            let peer = resolvePeer(args.peerId);
            if (!peer) {
                return null;
            }
            return await Modules.Matchmaking.getRoom(ctx, peer.id, peer.type);
        }),
        matchmakingProfile: withUser(async (ctx, args) => {
            let peer = resolvePeer(args.peerId);
            if (!peer) {
                return null;
            }
            return await Modules.Matchmaking.getRoom(ctx, peer.id, peer.type);
        })
    },
    Mutation: {
        matchmakingRoomSave: withUser(async (ctx, args, uid) => {
            let peer = resolvePeer(args.peerId);
            if (!peer) {
                return null;
            }
            args.input = {
                ...args.input,
                questions: args.input.questions ?
                    args.input.questions.map(a => ({ ...a, id: a.id ? IDs.MatchmakingQuestion.parse(a.id) : null }))
                     : null
            };
            return await Modules.Matchmaking.saveRoom(ctx, peer.id, peer.type, args.input);
        }),
        matchmakingProfileFill: withUser(async (ctx, args, uid) => {
            let peer = resolvePeer(args.peerId);
            if (!peer) {
                return null;
            }
            return await Modules.Matchmaking.fillRoomProfile(ctx, peer.id, peer.type, uid, args.input.answers.map(a => ({
                ...a,
                questionId: IDs.MatchmakingQuestion.parse(a.questionId)
            })));
        }),
        matchmakingStartConversation: withUser(async (ctx, args, uid) => {
            let peer = resolvePeer(args.peerId);
            if (!peer) {
                return null;
            }
            return null;
        }),
    }

} as GQLResolver;