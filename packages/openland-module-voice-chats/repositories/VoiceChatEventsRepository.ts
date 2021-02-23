import { injectable } from 'inversify';
import { getTransaction, transactional } from '@openland/foundationdb';
import { Context } from '@openland/context';
import { Store } from '../../openland-module-db/FDB';
import {
    VoiceChatParticipantUpdatedEvent,
    VoiceChatUpdatedEvent
} from '../../openland-module-db/store';
import { UnreliableEvents } from '../../openland-module-pubsub/UnreliableEvents';

@injectable()
export class VoiceChatEventsRepository {
    public activeChatsEvents = new UnreliableEvents<VoiceChatUpdatedEvent>('active_voice_chats');

    @transactional
    async postParticipantUpdated(ctx: Context, cid: number, uid: number) {
        Store.VoiceChatEventsStore.post(ctx, cid, VoiceChatParticipantUpdatedEvent.create({ cid, uid }));
        getTransaction(ctx).afterCommit(() => {
            this.activeChatsEvents.post('global', VoiceChatUpdatedEvent.create({ cid }));
        });
    }

    @transactional
    async postChatUpdated(ctx: Context, cid: number) {
        Store.VoiceChatEventsStore.post(ctx, cid, VoiceChatUpdatedEvent.create({ cid }));
        getTransaction(ctx).afterCommit(() => {
            this.activeChatsEvents.post('global', VoiceChatUpdatedEvent.create({ cid }));
        });
    }

    createActiveChatsLiveStream = (ctx: Context) => {
        return this.activeChatsEvents.createLiveStream(ctx, 'global');
    }
}