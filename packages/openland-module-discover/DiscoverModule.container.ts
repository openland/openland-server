import { container } from '../openland-modules/Modules.container';
import { DiscoverModule } from './DiscoverModule';
import { ChatCollectionsMediator } from './mediators/ChatCollectionsMediator';
import { ChatCollectionsRepository } from './repositories/ChatCollectionsRepository';

export function loadDiscoverModule() {
    container.bind(DiscoverModule).toSelf().inSingletonScope();
    container.bind('ChatCollectionsMediator').to(ChatCollectionsMediator);
    container.bind('ChatCollectionsRepository').to(ChatCollectionsRepository);
}
