import { injectable } from 'inversify';
import { transactional } from '@openland/foundationdb';
import { Context } from '@openland/context';
import { Store } from '../../openland-module-db/FDB';
import {
    VoiceChatParticipantUpdatedEvent,
    VoiceChatUpdatedEvent
} from '../../openland-module-db/store';

@injectable()
export class VoiceChatEventsRepository {
    @transactional
    async postParticipantUpdated(ctx: Context, cid: number, uid: number) {
        Store.VoiceChatEventsStore.post(ctx, cid, VoiceChatParticipantUpdatedEvent.create({ cid, uid }));
    }

    @transactional
    async postChatUpdated(ctx: Context, cid: number) {
        Store.VoiceChatEventsStore.post(ctx, cid, VoiceChatUpdatedEvent.create({ cid }));
    }
}