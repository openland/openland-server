import { container } from '../openland-modules/Modules.container';
import { NotificationCenterRepository } from './repositories/NotificationCenterRepository';
import { NotificationCenterMediator } from './mediators/NotificationCenterMediator';
import { NeedDeliveryRepository } from './repositories/NeedDeliveryRepository';
import { NotificationCenterModule } from './NotificationCenterModule';

export function loadNotificationCenterModule() {
    container.bind('NeedDeliveryRepository').to(NeedDeliveryRepository).inSingletonScope();
    container.bind('NotificationCenterRepository').to(NotificationCenterRepository).inSingletonScope();
    container.bind('NotificationCenterMediator').to(NotificationCenterMediator).inSingletonScope();
    container.bind(NotificationCenterModule).toSelf().inSingletonScope();
}