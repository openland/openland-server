import { container } from 'openland-modules/Modules.container';
import { FeedModule } from './FeedModule';
import { FeedRepository } from './repositories/FeedRepository';

export function loadFeedModule() {
    container.bind(FeedModule).toSelf().inSingletonScope();
    container.bind(FeedRepository).toSelf().inSingletonScope();
}