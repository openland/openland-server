import { container } from 'openland-modules/Modules.container';
import { FeedModule } from './FeedModule';
import { FeedRepository } from './repositories/FeedRepository';
import { RichMessageRepository } from '../openland-module-rich-message/repositories/RichMessageRepository';

export function loadFeedModule() {
    container.bind(FeedModule).toSelf().inSingletonScope();
    container.bind(FeedRepository).toSelf().inSingletonScope();
    container.bind('RichMessageRepository').to(RichMessageRepository);
}