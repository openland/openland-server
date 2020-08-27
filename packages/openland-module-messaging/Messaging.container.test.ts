import { loadMessagingModule } from './Messaging.container';
import { container } from 'openland-modules/Modules.container';
import { TypingsModule } from 'openland-module-typings/TypingsModule';
import { TypingsModuleMock } from 'openland-module-typings/TypingsModule.mock';
import { DraftsModule } from 'openland-module-drafts/DraftsModule';
import { loadCommentsModule } from 'openland-module-comments/CommentsModule.container';
import { loadNotificationCenterModule } from '../openland-module-notification-center/NotificationCenterModule.container';
import { MetricsModule } from '../openland-module-metrics/MetricsModule';
import { PushModule } from '../openland-module-push/PushModule';
import { PushModuleMock } from '../openland-module-push/PushModule.mock';
import { PresenceModule } from '../openland-module-presences/PresenceModule';
import { SearchModule } from '../openland-module-search/SearchModule';
import { FastCountersRepository } from './repositories/FastCountersRepository';

export function loadMessagingTestModule() {
    loadMessagingModule();
    loadCommentsModule();
    loadNotificationCenterModule();
    container.bind(SearchModule).toSelf().inSingletonScope();
    container.bind(TypingsModule).to(TypingsModuleMock as any).inSingletonScope();
    container.bind(PushModule).to(PushModuleMock as any).inSingletonScope();
    container.bind(PresenceModule).toSelf().inSingletonScope();
    container.bind(DraftsModule).toSelf().inSingletonScope();
    container.bind(MetricsModule).toSelf().inSingletonScope();
    container.bind(FastCountersRepository).toSelf().inSingletonScope();
    // container.bind(PushModule).toSelf().inSingletonScope();
}