import { container } from 'openland-modules/Modules.container';
import { FeedModule } from './FeedModule';
import { FeedRepository } from './repositories/FeedRepository';
import { RichMessageRepository } from '../openland-module-rich-message/repositories/RichMessageRepository';
import { FeedDeliveryMediator } from './repositories/FeedDeliveryMediator';
import { FeedChannelRepository } from './repositories/FeedChannelRepository';
import FeedChannelMediator from './repositories/FeedChannelMediator';
import { FeedMentionNotificationsMediator } from './repositories/FeedMentionNotificationsMediator';

export function loadFeedModule() {
    container.bind(FeedModule).toSelf().inSingletonScope();
    container.bind('FeedRepository').to(FeedRepository);
    container.bind('RichMessageRepository').to(RichMessageRepository);
    container.bind('FeedDeliveryMediator').to(FeedDeliveryMediator);
    container.bind('FeedChannelRepository').to(FeedChannelRepository);
    container.bind('FeedChannelMediator').to(FeedChannelMediator);
    container.bind('FeedMentionNotificationsMediator').to(FeedMentionNotificationsMediator);
}