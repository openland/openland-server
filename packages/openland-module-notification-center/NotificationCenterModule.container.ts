import { container } from '../openland-modules/Modules.container';
import { NotificationCenterRepository } from './repositories/NotificationCenterRepository';
import { NotificationCenterMediator } from './mediators/NotificationCenterMediator';
import { NeedDeliveryRepository } from './repositories/NeedDeliveryRepository';

export function loadNotificationCenterModule() {
    container.bind('NotificationCenterRepository').to(NotificationCenterRepository);
    container.bind('NotificationCenterMediator').to(NotificationCenterMediator);
    container.bind('NeedDeliveryRepository').to(NeedDeliveryRepository);
}