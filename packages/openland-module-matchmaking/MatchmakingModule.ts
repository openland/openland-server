import { injectable } from 'inversify';
import { lazyInject } from '../openland-modules/Modules.container';
import {
    MatchmakingRepository,
    PeerType,
} from './repositories/MatchmakingRepository';
import { Context } from '@openland/context';
import { GQL } from '../openland-module-api/schema/SchemaSpec';
import MatchmakingRoomInput = GQL.MatchmakingRoomInput;
import MatchmakingAnswerInput = GQL.MatchmakingAnswerInput;
import { Modules } from '../openland-modules/Modules';
import { Store } from '../openland-module-db/FDB';
import { buildMessage, userMention } from '../openland-utils/MessageBuilder';

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

    saveRoom = async (ctx: Context, peerId: number, peerType: PeerType, uid: number, input: MatchmakingRoomInput) => {
        let prevRoomEnabled = (await this.repo.getRoom(ctx, peerId, peerType)).enabled;
        let room = await this.repo.saveRoom(ctx, peerId, peerType, uid, input);
        if (peerType === 'room' && room.enabled !== prevRoomEnabled) {
            if (room.enabled) {
                await Modules.Messaging.sendMessage(ctx, peerId, uid, {
                    ...buildMessage(userMention(await Modules.Users.getUserFullName(ctx, uid), uid),
                        ' has enabled member profiles in this chat. Create your member profile to participate'),
                    isService: true,
                });
            } else {
                await Modules.Messaging.sendMessage(ctx, peerId, uid, {
                    ...buildMessage(userMention(await Modules.Users.getUserFullName(ctx, uid), uid),
                        ' has disabled member profiles in this chat.'),
                    isService: true,
                });
            }
        }
        return room;
    }

    fillRoomProfile = (ctx: Context, peerId: number, peerType: PeerType, uid: number, answers: MatchmakingAnswerInput[]) => {
        return this.repo.fillRoomProfile(ctx, peerId, peerType, uid, answers);
    }

    connect = async (ctx: Context, peerId: number, peerType: PeerType, uid: number, uid2: number) => {
        let convPrivate = await Store.ConversationPrivate.users.find(ctx, Math.min(uid, uid2), Math.max(uid, uid2));
        if (convPrivate) {
            return false;
        }
        let conv = await Modules.Messaging.room.resolvePrivateChat(ctx, uid, uid2);
        await Modules.Messaging.sendMessage(ctx, conv.id, uid, {
            ...buildMessage(
                userMention(await Modules.Users.getUserFullName(ctx, uid), uid),
                ' and ',
                userMention(await Modules.Users.getUserFullName(ctx, uid2), uid2),
                ' you’re matched in Matchmaking chat'
            ),
            isService: true
        });
        return true;
    }
}