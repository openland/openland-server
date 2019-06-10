import { container } from 'openland-modules/Modules.container';
import { CommentsRepository } from './CommentsRepository';
import { CommentsMediator } from './CommentsMediator';
import { CommentAugmentationMediator } from './CommentAugmentationMediator';
import { CommentsNotificationsMediator } from './CommentsNotificationsMediator';
import { CommentsNotificationsRepository } from './CommentsNotificationsRepository';
import { CommentsModule } from './CommentsModule';

export function loadCommentsModule() {
    container.bind('CommentsRepository').to(CommentsRepository);
    container.bind('CommentsMediator').to(CommentsMediator);
    container.bind('CommentsNotificationsRepository').to(CommentsNotificationsRepository);
    container.bind('CommentsNotificationsMediator').to(CommentsNotificationsMediator);
    container.bind('CommentAugmentationMediator').to(CommentAugmentationMediator);
    container.bind(CommentsModule).toSelf().inSingletonScope();
}