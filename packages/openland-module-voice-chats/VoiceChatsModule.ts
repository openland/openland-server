import { injectable } from 'inversify';
import { lazyInject } from 'openland-modules/Modules.container';
import { ParticipantsMediator } from './mediators/ParticipantsMediator';
import { VoiceChatsMediator } from './mediators/VoiceChatsMediator';
import { VoiceChatEventsMediator } from './mediators/VoiceChatEventsMediator';
import { serverRoleEnabled } from '../openland-utils/serverRoleEnabled';
import { startVoiceChatsCleanupWorker } from './workers/voiceChatsCleanupWorker';

@injectable()
export class VoiceChatsModule {
    @lazyInject('VoiceChatParticipantsMediator')
    public readonly participants!: ParticipantsMediator;

    @lazyInject('VoiceChatsMediator')
    public readonly chats!: VoiceChatsMediator;

    @lazyInject('VoiceChatEventsMediator')
    public readonly events!: VoiceChatEventsMediator;

    start = async () => {
        this.chats.start();

        if (serverRoleEnabled('workers')) {
            startVoiceChatsCleanupWorker();
        }
    }
}