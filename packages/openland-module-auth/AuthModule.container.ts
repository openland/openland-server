import { container } from 'openland-modules/Modules.container';
import { TokenRepository } from './repositories/TokenRepository';

export function loadAuthModule() {
    container.bind('TokenRepository').to(TokenRepository).inSingletonScope();
}