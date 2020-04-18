import { CallSchedulerKitchen } from './repositories/CallSchedulerKitchen';
import { MediaKitchenRepository } from './repositories/MediaKitchenRepository';
import { container } from 'openland-modules/Modules.container';
import { CallsModule } from './CallsModule';
import { CallRepository } from './repositories/CallRepository';

export function loadCallsModule() {
    container.bind(CallsModule).toSelf().inSingletonScope();
    container.bind(CallRepository).toSelf().inSingletonScope();
    container.bind('MediaKitchenRepository').to(MediaKitchenRepository).inSingletonScope();
    container.bind('CallSchedulerKitchen').to(CallSchedulerKitchen).inSingletonScope();
}