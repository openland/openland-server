import { injectable } from 'inversify';
import { lazyInject } from '../openland-modules/Modules.container';
import {
    MatchmakingAnswerInput,
    MatchmakingRepository,
    MatchmakingRoomInput, PeerType,
} from './repositories/MatchmakingRepository';
import { Context } from '@openland/context';

@injectable()
export class MatchmakingModule {
    @lazyInject('MatchmakingRepository') private readonly repo!: MatchmakingRepository;

    start = () => {
        // no op
    }

    getRoom = (ctx: Context, peerId: number, peerType: PeerType) => {
        return this.repo.getRoom(ctx, peerId, peerType);
    }

    getRoomProfiles = async (ctx: Context, peerId: number, peerType: PeerType) => {
        return this.repo.getRoomProfiles(ctx, peerId, peerType);
    }

    getRoomProfile = (ctx: Context, peerId: number, peerType: PeerType, uid: number) => {
        return this.repo.getRoomProfile(ctx, peerId, peerType, uid);
    }

    saveRoom = (ctx: Context, peerId: number, peerType: PeerType, input: MatchmakingRoomInput) => {
        return this.repo.saveRoom(ctx, peerId, peerType, input);
    }

    fillRoomProfile = (ctx: Context, peerId: number, peerType: PeerType, uid: number, answers: MatchmakingAnswerInput[]) => {
        return this.repo.fillRoomProfile(ctx, peerId, peerType, uid, answers);
    }
}