import { container } from '../openland-modules/Modules.container';
import { MatchmakingRepository } from './repositories/MatchmakingRepository';
import { MatchmakingModule } from './MatchmakingModule';
import { MatchmakingMediator } from './mediators/MatchmakingMediator';

export function loadMatchmakingModule() {
    container.bind('MatchmakingRepository').to(MatchmakingRepository);
    container.bind('MatchmakingMediator').to(MatchmakingMediator);
    container.bind(MatchmakingModule).toSelf().inSingletonScope();
}