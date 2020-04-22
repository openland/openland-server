import { CallSchedulerKitchenConnections } from './repositories/CallSchedulerKitchenConnections';
import { CallSchedulerKitchen } from './repositories/CallSchedulerKitchen';
import { MediaKitchenRepository } from './kitchen/MediaKitchenRepository';
import { container } from 'openland-modules/Modules.container';
import { CallsModule } from './CallsModule';
import { CallRepository } from './repositories/CallRepository';

export function loadCallsModule() {
    container.bind(CallsModule).toSelf().inSingletonScope();
    container.bind('CallRepository').to(CallRepository).inSingletonScope();
    container.bind('MediaKitchenRepository').to(MediaKitchenRepository).inSingletonScope();
    container.bind('CallSchedulerKitchen').to(CallSchedulerKitchen).inSingletonScope();
    container.bind('CallSchedulerKitchenConnections').to(CallSchedulerKitchenConnections).inSingletonScope();
}