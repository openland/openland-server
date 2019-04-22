import { WorkQueue } from '../openland-module-workers/WorkQueue';
import { AllEntities, Comment } from '../openland-module-db/schema';
import { injectable } from 'inversify';
import { lazyInject } from '../openland-modules/Modules.container';
import { serverRoleEnabled } from '../openland-utils/serverRoleEnabled';
import { createUrlInfoService } from '../openland-module-messaging/workers/UrlInfoService';
import { Context, createEmptyContext } from '../openland-utils/Context';
import { MessageAttachmentFileInput, MessageRichAttachmentInput } from '../openland-module-messaging/MessageInput';
import linkify from 'linkify-it';
import tlds from 'tlds';
import { CommentsRepository } from './CommentsRepository';

const linkifyInstance = linkify()
    .tlds(tlds)
    .tlds('onion', true);

@injectable()
export class CommentAugmentationMediator {
    private readonly queue = new WorkQueue<{ commentId: number }, { result: string }>('comment_augmentation_task');

    @lazyInject('FDB') private readonly entities!: AllEntities;
    @lazyInject('CommentsRepository') private readonly comments!: CommentsRepository;

    private started = false;

    start = () => {
        if (this.started) {
            return;
        }
        this.started = true;

        if (serverRoleEnabled('workers')) {
            let service = createUrlInfoService();
            this.queue.addWorker(async (item) => {
                let message = await this.entities.Comment.findById(createEmptyContext(), item.commentId);

                if (!message || !message.text) {
                    return { result: 'ok' };
                }

                let urls = this.resolveLinks(message);
                if (urls.length === 0) {
                    return { result: 'ok' };
                }
                let firstUrl = urls[0];
                let urlInfo = await service.fetchURLInfo(firstUrl.url);

                if (!urlInfo) {
                    return { result: 'ok' };
                }

                let haveContent = (urlInfo.title && urlInfo.description) || (urlInfo.title && urlInfo.imageInfo) || (urlInfo.description && urlInfo.imageInfo);
                let isImage = !urlInfo.title && !urlInfo.description && urlInfo.imageInfo;

                if (haveContent || urlInfo.internal) {
                    let richAttachment: MessageRichAttachmentInput = {
                        type: 'rich_attachment',
                        title: urlInfo.title || null,
                        titleLink: urlInfo.url,
                        titleLinkHostname: urlInfo.hostname || null,
                        subTitle: urlInfo.subtitle || null,
                        text: urlInfo.description || null,
                        icon: urlInfo.iconRef || null,
                        iconInfo: urlInfo.iconInfo || null,
                        image: urlInfo.photo || null,
                        imageInfo: urlInfo.imageInfo || null,
                        keyboard: urlInfo.keyboard || null,
                    };

                    await this.comments.editComment(
                        createEmptyContext(),
                        item.commentId,
                        { attachments: [richAttachment] },
                        false
                    );
                } else if (isImage) {
                    let fileAttachment: MessageAttachmentFileInput = {
                        type: 'file_attachment',
                        fileId: urlInfo.photo!.uuid,
                        fileMetadata: urlInfo.imageInfo!,
                        filePreview: null
                    };

                    await this.comments.editComment(
                        createEmptyContext(),
                        item.commentId,
                        { attachments: [fileAttachment] },
                        false
                    );
                }
                return { result: 'ok' };
            });
        }
    }

    onNewComment = async (ctx: Context, comment: Comment) => {
        if (this.resolveLinks(comment).length > 0) {
            await this.queue.pushWork(ctx, { commentId: comment.id });
        }
    }

    onCommentUpdated = async (ctx: Context, comment: Comment) => {
        if (this.resolveLinks(comment).length > 0) {
            await this.queue.pushWork(ctx, { commentId: comment.id });
        }
    }

    private resolveLinks = (comment: Comment) => {
        if (!comment || !comment.text) {
            return [];
        }
        let urls = linkifyInstance.match(comment.text);

        if (!urls) {
            return [];
        }

        return urls.filter(u => u.url.startsWith('http:') || u.url.startsWith('https:'));
    }
}