import { injectable } from 'inversify';
import { lazyInject } from '../openland-modules/Modules.container';
import {
    MatchmakingPeerType,
} from './repositories/MatchmakingRepository';
import { Context } from '@openland/context';
import { GQL } from '../openland-module-api/schema/SchemaSpec';
import MatchmakingRoomInput = GQL.MatchmakingRoomInput;
import MatchmakingAnswerInput = GQL.MatchmakingAnswerInput;
import { MatchmakingMediator } from './mediators/MatchmakingMediator';

@injectable()
export class MatchmakingModule {
    @lazyInject('MatchmakingMediator') private readonly mediator!: MatchmakingMediator;

    start = () => {
        // no op
    }

    getRoom = (ctx: Context, peerId: number, peerType: MatchmakingPeerType) => {
        return this.mediator.getRoom(ctx, peerId, peerType);
    }

    getRoomProfiles = async (ctx: Context, peerId: number, peerType: MatchmakingPeerType) => {
        return this.mediator.getRoomProfiles(ctx, peerId, peerType);
    }

    getRoomProfile = (ctx: Context, peerId: number, peerType: MatchmakingPeerType, uid: number) => {
        return this.mediator.getRoomProfile(ctx, peerId, peerType, uid);
    }

    saveRoom = (ctx: Context, peerId: number, peerType: MatchmakingPeerType, uid: number, input: MatchmakingRoomInput) => {
        return this.mediator.saveRoom(ctx, peerId, peerType, uid, input);
    }

    fillRoomProfile = (ctx: Context, peerId: number, peerType: MatchmakingPeerType, uid: number, answers: MatchmakingAnswerInput[]) => {
        return this.mediator.fillRoomProfile(ctx, peerId, peerType, uid, answers);
    }

    clearProfile = (ctx: Context, peerId: number, peerType: MatchmakingPeerType, uid: number)  => {
        return this.mediator.clearProfile(ctx, peerId, peerType, uid);
    }

    connect = (ctx: Context, peerId: number, peerType: MatchmakingPeerType, uid: number, uid2: number) => {
        return this.mediator.connect(ctx, peerId, peerType, uid, uid2);
    }
}