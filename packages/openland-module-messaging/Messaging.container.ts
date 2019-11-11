import { container } from 'openland-modules/Modules.container';
import { MessagingModule } from './MessagingModule';
import { UserStateRepository } from './repositories/UserStateRepository';
import { DeliveryRepository } from './repositories/DeliveryRepository';
import { CountersRepository } from './repositories/CountersRepository';
import { MessagingRepository } from './repositories/MessagingRepository';
import { RoomRepository } from './repositories/RoomRepository';
import { MessagingMediator } from './mediators/MessagingMediator';
import { AugmentationMediator } from './mediators/AugmentationMediator';
import { DeliveryMediator } from './mediators/DeliveryMediator';
import { CountersMediator } from './mediators/CountersMediator';
import { RoomMediator } from './mediators/RoomMediator';
import { FixerRepository } from './repositories/Fixer';
import { ChatMetricsRepository } from './repositories/ChatMetricsRepository';
import { NeedNotificationDeliveryRepository } from './repositories/NeedNotificationDeliveryRepository';
import { UserDialogsRepository } from './repositories/UserDialogsRepository';
import { MentionNotificationsMediator } from './mediators/MentionNotificationsMediator';

export function loadMessagingModule() {
    container.bind(MessagingModule).toSelf().inSingletonScope();
    container.bind('UserStateRepository').to(UserStateRepository).inSingletonScope();
    container.bind('DeliveryRepository').to(DeliveryRepository).inSingletonScope();
    container.bind('CountersRepository').to(CountersRepository).inSingletonScope();
    container.bind('MessagingRepository').to(MessagingRepository).inSingletonScope();
    container.bind('RoomRepository').to(RoomRepository).inSingletonScope();
    container.bind('MessagingMediator').to(MessagingMediator).inSingletonScope();
    container.bind('AugmentationMediator').to(AugmentationMediator).inSingletonScope();
    container.bind('DeliveryMediator').to(DeliveryMediator).inSingletonScope();
    container.bind('CountersMediator').to(CountersMediator).inSingletonScope();
    container.bind('RoomMediator').to(RoomMediator).inSingletonScope();
    container.bind('FixerRepository').to(FixerRepository).inSingletonScope();
    container.bind('ChatMetricsRepository').to(ChatMetricsRepository).inSingletonScope();
    container.bind('NeedNotificationDeliveryRepository').to(NeedNotificationDeliveryRepository).inSingletonScope();
    container.bind('UserDialogsRepository').to(UserDialogsRepository).inSingletonScope();
    container.bind('MentionNotificationsMediator').to(MentionNotificationsMediator).inSingletonScope();
}