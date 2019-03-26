import { container } from 'openland-modules/Modules.container';
import { CommentsRepository } from './CommentsRepository';
import { CommentsMediator } from './CommentsMediator';

export function loadCommentsModule() {
    container.bind('CommentsRepository').to(CommentsRepository);
    container.bind('CommentsMediator').to(CommentsMediator);
}