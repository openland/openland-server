import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { lazyInject } from '../../openland-modules/Modules.container';
import { VoiceChatEventsRepository } from '../repositories/VoiceChatEventsRepository';

@injectable()
export class VoiceChatEventsMediator {
    @lazyInject('VoiceChatEventsRepository')
    private readonly repo!: VoiceChatEventsRepository;

    postParticipantUpdated = async (ctx: Context, cid: number, uid: number) => {
        await this.repo.postParticipantUpdated(ctx, cid, uid);
    }

    postChatUpdated = async (ctx: Context, cid: number) => {
        await this.repo.postChatUpdated(ctx, cid);
    }
}