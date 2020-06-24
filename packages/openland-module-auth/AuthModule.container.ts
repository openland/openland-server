import { container } from 'openland-modules/Modules.container';
import { TokenRepository } from './repositories/TokenRepository';
import { AuthCodeRepository } from './repositories/AuthCodeRepository';
import { AuthManagementRepository } from './repositories/AuthManagementRepository';
import { AuthManagementMediator } from './mediators/AuthManagementMediator';
import { SessionsMediator } from './mediators/SessionsMediator';

export function loadAuthModule() {
    container.bind('TokenRepository').to(TokenRepository).inSingletonScope();
    container.bind('AuthCodeRepository').to(AuthCodeRepository).inSingletonScope();
    container.bind('AuthManagementMediator').to(AuthManagementMediator).inSingletonScope();
    container.bind('AuthManagementRepository').to(AuthManagementRepository).inSingletonScope();
    container.bind('SessionsMediator').to(SessionsMediator).inSingletonScope();
}
