import { CallSchedulerKitchenTransport } from './repositories/CallSchedulerKitchenTransport';
import { CallSchedulerKitchen } from './repositories/CallSchedulerKitchen';
import { MediaKitchenRepository } from './kitchen/MediaKitchenRepository';
import { container } from 'openland-modules/Modules.container';
import { CallsModule } from './CallsModule';
import { CallRepository } from './repositories/CallRepository';
import { CallSchedulerScalable } from './repositories/CallSchedulerScalable';

export function loadCallsModule() {
    container.bind(CallsModule).toSelf().inSingletonScope();
    container.bind('CallRepository').to(CallRepository).inSingletonScope();
    container.bind('MediaKitchenRepository').to(MediaKitchenRepository).inSingletonScope();
    container.bind('CallSchedulerKitchen').to(CallSchedulerKitchen).inSingletonScope();
    container.bind('CallSchedulerKitchenTransport').to(CallSchedulerKitchenTransport).inSingletonScope();
    container.bind('CallSchedulerScalable').to(CallSchedulerScalable).inSingletonScope();
}