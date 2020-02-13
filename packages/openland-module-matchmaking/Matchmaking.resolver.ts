import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { IDs, IdsFactory } from '../openland-module-api/IDs';
import { GQLRoots } from '../openland-module-api/schema/SchemaRoots';
import MatchmakingAnswerRoot = GQLRoots.MatchmakingAnswerRoot;
import MatchmakingQuestionRoot = GQLRoots.MatchmakingQuestionRoot;
import { Modules } from 'openland-modules/Modules';
import { AuthContext } from '../openland-module-auth/AuthContext';
import { withUser } from 'openland-module-api/Resolvers';
import { MatchmakingPeerType } from './repositories/MatchmakingRepository';
import { NotFoundError } from '../openland-errors/NotFoundError';
import { Store } from '../openland-module-db/FDB';
import MatchmakingPeerRoot = GQLRoots.MatchmakingPeerRoot;
import { ConversationRoom } from '../openland-module-db/store';
import { AccessDeniedError } from '../openland-errors/AccessDeniedError';
import MultiselectMatchmakingQuestionRoot = GQLRoots.MultiselectMatchmakingQuestionRoot;
import TextMatchmakingQuestionRoot = GQLRoots.TextMatchmakingQuestionRoot;

let resolvePeer = (id: string): { id: number, type: MatchmakingPeerType } | null => {
    let idMeta = IdsFactory.resolve(id);
    if (idMeta.type.typeName === 'Conversation') {
        return { id: idMeta.id.valueOf() as number, type: 'room' };
    }
    return null;
};

export const Resolver: GQLResolver = {
    MatchmakingPeer: {
        __resolveType(obj: MatchmakingPeerRoot) {
            if (obj instanceof ConversationRoom) {
                return 'SharedRoom';
            }
            throw new Error('Unsupported matchmaking peer type');
        }
    },
    MatchmakingRoom: {
        enabled: src => src.enabled,
        myProfile: async (src, _, ctx) => {
            let auth = AuthContext.get(ctx);
            if (!auth.uid) {
                return null;
            }
            return await Modules.Matchmaking.getRoomProfile(ctx, src.peerId, src.peerType as any, auth.uid);
        },
        profiles: async (src, _, ctx) => await Modules.Matchmaking.getRoomProfiles(ctx, src.peerId, src.peerType as any),
        questions: src => src.questions,
        peer: async (src, _, ctx) => {
            if (src.peerType === 'room') {
                let auth = AuthContext.get(ctx);
                if (!auth.uid) {
                    throw new AccessDeniedError();
                }
                // should be covered by Room.resolver
                // await Modules.Messaging.room.checkCanUserSeeChat(ctx, auth.uid, src.peerId);
                return (await Store.ConversationRoom.findById(ctx, src.peerId))!;
            }
            throw new Error(`Invalid peer type: ${src.peerType}`);
        },
    },
    MatchmakingProfile: {
        answers: root => root.answers || [],
        user: root => root.uid,
        chatCreated: async (root, _, ctx) => {
            let auth = AuthContext.get(ctx);
            if (!auth.uid) {
                return false;
            }
            return await Modules.Messaging.room.hasPrivateChat(ctx, root.uid, auth.uid);
        }
    },
    MatchmakingAnswer: {
        __resolveType(obj: MatchmakingAnswerRoot) {
            if (obj.type === 'multiselect') {
                return 'MultiselectMatchmakingAnswer';
            }
            if (obj.type === 'text') {
                return 'TextMatchmakingAnswer';
            }

            throw new Error('Unknown answer type');
        },
    },
    MultiselectMatchmakingAnswer: {
        question: root => root.question as MultiselectMatchmakingQuestionRoot,
        tags: root => root.tags,
    },
    TextMatchmakingAnswer: {
        question: root => root.question as TextMatchmakingQuestionRoot,
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
        subtitle: src => src.subtitle || '',
        tags: src => src.tags,
    },
    TextMatchmakingQuestion: {
        id: src => IDs.MatchmakingQuestion.serialize(src.id),
        title: src => src.title,
        subtitle: src => src.subtitle || '',
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
            return await Modules.Matchmaking.getRoomProfile(ctx, peer.id, peer.type, IDs.User.parse(args.uid));
        })
    },
    Mutation: {
        matchmakingRoomSave: withUser(async (ctx, args, uid) => {
            let peer = resolvePeer(args.peerId);
            if (!peer) {
                throw new NotFoundError();
            }
            args.input = {
                ...args.input,
                questions: args.input.questions ?
                    args.input.questions.map(a => ({ ...a, id: a.id ? IDs.MatchmakingQuestion.parse(a.id) : null }))
                    : null
            };
            return await Modules.Matchmaking.saveRoom(ctx, peer.id, peer.type, uid, args.input);
        }),
        matchmakingProfileFill: withUser(async (ctx, args, uid) => {
            let peer = resolvePeer(args.peerId);
            if (!peer) {
                throw new NotFoundError();
            }
            return await Modules.Matchmaking.fillRoomProfile(ctx, peer.id, peer.type, uid, args.input.answers.map(a => ({
                ...a,
                questionId: IDs.MatchmakingQuestion.parse(a.questionId)
            })));
        }),
        matchmakingConnect: withUser(async (ctx, args, uid) => {
            let peer = resolvePeer(args.peerId);
            if (!peer) {
                return false;
            }
            let uid2 = IDs.User.parse(args.uid);

            return await Modules.Matchmaking.connect(ctx, peer.id, peer.type, uid, uid2);
        }),
    }
};
