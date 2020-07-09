import { container } from '../openland-modules/Modules.container';
import { PresenceModule } from './PresenceModule';
import { PresenceLogRepository } from './PresenceLogRepository';

export function loadPresenceModule() {
    container.bind(PresenceModule).toSelf().inSingletonScope();
    container.bind('PresenceLogRepository').to(PresenceLogRepository).inSingletonScope();
}