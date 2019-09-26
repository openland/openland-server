import { container } from '../openland-modules/Modules.container';
import { MatchmakingRepository } from './repositories/MatchmakingRepository';
import { MatchmakingModule } from './MatchmakingModule';

export function loadMatchmakingModule() {
    container.bind('MatchmakingRepository').to(MatchmakingRepository);
    container.bind(MatchmakingModule).toSelf().inSingletonScope();
}