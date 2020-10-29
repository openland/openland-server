import { container } from '../openland-modules/Modules.container';
import { SocialImageModule } from './SocialImageModule';
import { SocialImageRepository } from './repositories/SocialImageRepository';

export function loadSocialImageModule() {
    container.bind(SocialImageModule).toSelf().inSingletonScope();
    container.bind('SocialImageRepository').to(SocialImageRepository).inSingletonScope();
}