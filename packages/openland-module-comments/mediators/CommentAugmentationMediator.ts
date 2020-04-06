import { Comment } from './../../openland-module-db/store';
import { WorkQueue } from '../../openland-module-workers/WorkQueue';
import { injectable } from 'inversify';
import { lazyInject } from '../../openland-modules/Modules.container';
import { serverRoleEnabled } from '../../openland-utils/serverRoleEnabled';
import { createUrlInfoService } from '../../openland-module-messaging/workers/UrlInfoService';
import { MessageAttachmentFileInput, MessageRichAttachmentInput } from '../../openland-module-messaging/MessageInput';
import { CommentsRepository } from '../repositories/CommentsRepository';
import { createLinkifyInstance } from '../../openland-utils/createLinkifyInstance';
import { Context } from '@openland/context';
import { Store } from 'openland-module-db/FDB';
import * as URL from 'url';

const linkifyInstance = createLinkifyInstance();

@injectable()
export class CommentAugmentationMediator {
    private readonly queue = new WorkQueue<{ commentId: number }, { result: string }>('comment_augmentation_task');

    @lazyInject('CommentsRepository') private readonly comments!: CommentsRepository;

    private started = false;

    start = () => {
        if (this.started) {
            return;
        }
        this.started = true;

        if (serverRoleEnabled('workers')) {
            let service = createUrlInfoService();
            this.queue.addWorker(async (item, ctx) => {
                let message = await Store.Comment.findById(ctx, item.commentId);

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
                        imagePreview: urlInfo.photoPreview || null,
                        imageInfo: urlInfo.imageInfo || null,
                        imageFallback: urlInfo.photoFallback || null,
                        keyboard: urlInfo.keyboard || null,
                        socialImagePreview: urlInfo.socialImagePreview || null,
                        socialImageInfo: urlInfo.socialImageInfo || null,
                        socialImage: urlInfo.socialImage || null
                    };

                    await this.comments.editComment(
                        ctx,
                        item.commentId,
                        { attachments: [richAttachment], appendAttachments: true },
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
                        ctx,
                        item.commentId,
                        { attachments: [fileAttachment], appendAttachments: true },
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

        return urls
            .filter(u => u.url.startsWith('http:') || u.url.startsWith('https:'))
            .map(u => ({...u, url: URL.parse(u.url).href!}));
    }
}
