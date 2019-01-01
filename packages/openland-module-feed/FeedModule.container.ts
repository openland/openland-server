import { container } from 'openland-modules/Modules.container';
import { FeedModule } from './FeedModule';

export function loadFeedModule() {
    container.bind(FeedModule).toSelf().inSingletonScope();
}