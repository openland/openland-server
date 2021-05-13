import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { lazyInject } from '../../openland-modules/Modules.container';
import { VoiceChatEventsRepository } from '../repositories/VoiceChatEventsRepository';

@injectable()
export class VoiceChatEventsMediator {
    @lazyInject('VoiceChatEventsRepository')
    private readonly repo!: VoiceChatEventsRepository;

    createActiveChatsLiveStream = (ctx: Context) => {
        return this.repo.createActiveChatsLiveStream(ctx);
    }

    createActiveChatsCollapsingLiveStream = (ctx: Context) => {
        return this.repo.createActiveChatsCollapsingLiveStream(ctx);
    }
}