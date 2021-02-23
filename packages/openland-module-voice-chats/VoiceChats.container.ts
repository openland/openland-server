import { container } from '../openland-modules/Modules.container';
import { VoiceChatsModule } from './VoiceChatsModule';
import { VoiceChatsRepository } from './repositories/VoiceChatsRepository';
import { VoiceChatsMediator } from './mediators/VoiceChatsMediator';
import { ParticipantsMediator } from './mediators/ParticipantsMediator';
import { ParticipantsRepository } from './repositories/ParticipantsRepository';
import { VoiceChatEventsRepository } from './repositories/VoiceChatEventsRepository';
import { VoiceChatEventsMediator } from './mediators/VoiceChatEventsMediator';

export function loadVoiceChatsModule() {
    container.bind(VoiceChatsModule).toSelf().inSingletonScope();
    container.bind('VoiceChatsRepository').to(VoiceChatsRepository).inSingletonScope();
    container.bind('VoiceChatsMediator').to(VoiceChatsMediator).inSingletonScope();

    container.bind('VoiceChatParticipantsRepository').to(ParticipantsRepository).inSingletonScope();
    container.bind('VoiceChatParticipantsMediator').to(ParticipantsMediator).inSingletonScope();

    container.bind('VoiceChatEventsRepository').to(VoiceChatEventsRepository).inSingletonScope();
    container.bind('VoiceChatEventsMediator').to(VoiceChatEventsMediator).inSingletonScope();
}