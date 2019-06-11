import { container } from 'openland-modules/Modules.container';
import { CommentsRepository } from './repositories/CommentsRepository';
import { CommentsMediator } from './mediators/CommentsMediator';
import { CommentsNotificationsMediator } from './mediators/CommentsNotificationsMediator';
import { CommentsNotificationsRepository } from './repositories/CommentsNotificationsRepository';
import { CommentsModule } from './CommentsModule';
import { CommentAugmentationMediator } from './mediators/CommentAugmentationMediator';

export function loadCommentsModule() {
    container.bind('CommentsRepository').to(CommentsRepository);
    container.bind('CommentsMediator').to(CommentsMediator);
    container.bind('CommentsNotificationsRepository').to(CommentsNotificationsRepository);
    container.bind('CommentsNotificationsMediator').to(CommentsNotificationsMediator);
    container.bind('CommentAugmentationMediator').to(CommentAugmentationMediator);
    container.bind(CommentsModule).toSelf().inSingletonScope();
}