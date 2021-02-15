import { injectable } from 'inversify';
import { lazyInject } from 'openland-modules/Modules.container';
import { ParticipantsMediator } from './mediators/ParticipantsMediator';
import { VoiceChatMediator } from './mediators/VoiceChatMediator';

@injectable()
export class VoiceChatModule {
    @lazyInject('VoiceChatParticipantsMediator')
    public readonly participants!: ParticipantsMediator;

    @lazyInject('VoiceChatMediator')
    public readonly chats!: VoiceChatMediator;
}