import { container } from 'openland-modules/Modules.container';
import { CommentsRepository } from './CommentsRepository';
import { CommentsMediator } from './CommentsMediator';
import { CommentAugmentationMediator } from './CommentAugmentationMediator';

export function loadCommentsModule() {
    container.bind('CommentsRepository').to(CommentsRepository);
    container.bind('CommentsMediator').to(CommentsMediator);
    container.bind('CommentAugmentationMediator').to(CommentAugmentationMediator);
}