import { container } from 'openland-modules/Modules.container';
import { TokenRepository } from './repositories/TokenRepository';
import { AuthCodeRepository } from './repositories/AuthCodeRepository';

export function loadAuthModule() {
    container.bind('TokenRepository').to(TokenRepository).inSingletonScope();
    container.bind('AuthCodeRepository').to(AuthCodeRepository).inSingletonScope();
}
