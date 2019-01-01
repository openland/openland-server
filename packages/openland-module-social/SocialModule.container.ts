import { container } from 'openland-modules/Modules.container';
import { SocialModule } from './SocialModule';
import { InfluencerRepository } from './repositories/InfluencerRepository';

export function loadSocialModule() {
    container.bind(InfluencerRepository).toSelf().inSingletonScope();
    container.bind(SocialModule).toSelf().inSingletonScope();
}