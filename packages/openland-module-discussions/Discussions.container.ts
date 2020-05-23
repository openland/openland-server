import { DiscussionsModule } from './DiscussionsModule';
import { container } from 'openland-modules/Modules.container';

export function loadDiscussionsModule() {
    container.bind(DiscussionsModule).toSelf().inSingletonScope();
}