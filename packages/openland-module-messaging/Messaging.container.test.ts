import { loadMessagingModule } from './Messaging.container';
import { container } from 'openland-modules/Modules.container';
import { TypingsModule } from 'openland-module-typings/TypingsModule';
import { TypingsModuleMock } from 'openland-module-typings/TypingsModule.mock';
import { DraftsModule } from 'openland-module-drafts/DraftsModule';
import { loadCommentsModule } from 'openland-module-comments/CommentsModule.container';

export function loadMessagingTestModule() {
    loadMessagingModule();
    loadCommentsModule();
    container.bind(TypingsModule).to(TypingsModuleMock as any).inSingletonScope();
    container.bind(DraftsModule).toSelf().inSingletonScope();
}