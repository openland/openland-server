import { injectable } from 'inversify';
import { lazyInject } from 'openland-modules/Modules.container';
import { ParticipantsMediator } from './mediators/ParticipantsMediator';
import { VoiceChatsMediator } from './mediators/VoiceChatsMediator';

@injectable()
export class VoiceChatsModule {
    @lazyInject('VoiceChatParticipantsMediator')
    public readonly participants!: ParticipantsMediator;

    @lazyInject('VoiceChatsMediator')
    public readonly chats!: VoiceChatsMediator;

    start = async () => {
        // no op
    }
}