import { container } from '../openland-modules/Modules.container';
import { NotificationCenterRepository } from './NotificationCenterRepository';
import { NotificationCenterMediator } from './NotificationCenterMediator';

export function loadNotificationCenterModule() {
    container.bind('NotificationCenterRepository').to(NotificationCenterRepository);
    container.bind('NotificationCenterMediator').to(NotificationCenterMediator);
}