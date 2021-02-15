import { container } from '../openland-modules/Modules.container';
import { VoiceChatModule } from './VoiceChatModule';
import { VoiceChatRepository } from './repositories/VoiceChatRepository';
import { VoiceChatMediator } from './mediators/VoiceChatMediator';
import { ParticipantsMediator } from './mediators/ParticipantsMediator';
import { ParticipantsRepository } from './repositories/ParticipantsRepository';

export function loadVoiceChatModule() {
    container.bind(VoiceChatModule).toSelf().inSingletonScope();
    container.bind('VoiceChatRepository').to(VoiceChatRepository).inSingletonScope();
    container.bind('VoiceChatMediator').to(VoiceChatMediator).inSingletonScope();

    container.bind('VoiceChatParticipantsRepository').to(ParticipantsRepository).inSingletonScope();
    container.bind('VoiceChatParticipantsMediator').to(ParticipantsMediator).inSingletonScope();
}