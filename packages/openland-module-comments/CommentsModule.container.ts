import { container } from 'openland-modules/Modules.container';
import { CommentsRepository } from './CommentsRepository';

export function loadCommentsModule() {
    container.bind('CommentsRepository').to(CommentsRepository);
}