import { container } from 'openland-modules/Modules.container';
import { SocialModule } from './SocialModule';
import { InfluencerRepository } from './repositories/InfluencerRepository';
import { ConnectionsRepository } from './repositories/ConnectionsRepository';

export function loadSocialModule() {
    container.bind(InfluencerRepository).toSelf().inSingletonScope();
    container.bind(ConnectionsRepository).toSelf().inSingletonScope();
    container.bind(SocialModule).toSelf().inSingletonScope();
}