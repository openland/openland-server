import { injectable } from 'inversify';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { createUrlInfoService } from 'openland-module-messaging/workers/UrlInfoService';
import { MessagesRepository } from 'openland-module-messaging/repositories/MessagesRepository';
import { lazyInject } from 'openland-modules/Modules.container';
import { MessageAttachmentFileInput, MessageRichAttachmentInput } from '../MessageInput';
import { createLinkifyInstance } from '../../openland-utils/createLinkifyInstance';
import { Context } from '@openland/context';
import { Store } from 'openland-module-db/FDB';
import { Message } from 'openland-module-db/store';
import { inTx } from '@openland/foundationdb';
import * as URL from 'url';
import { BetterWorkerQueue } from 'openland-module-workers/BetterWorkerQueue';

const linkifyInstance = createLinkifyInstance();

@injectable()
export class AugmentationMediator {
    private readonly queue = new BetterWorkerQueue<{ messageId: number }>(Store.MessageAugmentationQueue, { type: 'external', maxAttempts: 3 });

    @lazyInject('MessagesRepository') private readonly messaging!: MessagesRepository;

    private started = false;

    start = () => {
        if (this.started) {
            return;
        }
        this.started = true;

        if (serverRoleEnabled('workers')) {
            let service = createUrlInfoService();
            this.queue.addWorkers(100, async (root, item) => {
                let message = await inTx(root, async ctx => await Store.Message.findById(ctx, item.messageId));

                if (!message || !message.text) {
                    return;
                }

                if (message.isService) {
                    return;
                }

                // augmentation exists or was deleted
                if (message.augmentation) {
                    return;
                }

                let urls = this.resolveLinks(message);
                if (urls.length === 0) {
                    return;
                }

                let firstUrl = urls[0];
                if (message.attachmentsModern?.find(a => a.type === 'rich_attachment' && a.titleLink === firstUrl.url)) {
                    return;
                }

                let urlInfo = await service.fetchURLInfo(firstUrl.url);

                if (!urlInfo) {
                    return;
                }

                let haveContent = (urlInfo.title && urlInfo.description) || (urlInfo.title && urlInfo.imageInfo) || (urlInfo.description && urlInfo.imageInfo);
                let isImage = !urlInfo.title && !urlInfo.description && urlInfo.imageInfo;

                await inTx(root, async ctx => {
                    if (!urlInfo) {
                        return;
                    }
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
                            imageFallback: urlInfo.photoFallback || null,
                            imagePreview: urlInfo.photoPreview || null,
                            keyboard: urlInfo.keyboard || null,
                            socialImage: urlInfo.socialImage || null,
                            socialImageInfo: urlInfo.socialImageInfo || null,
                            socialImagePreview: urlInfo.socialImagePreview || null
                        };

                        await this.messaging.editMessage(
                            ctx,
                            item.messageId,
                            { attachments: [richAttachment], appendAttachments: true },
                            false
                        );
                    } else if (isImage) {
                        let fileAttachment: MessageAttachmentFileInput = {
                            type: 'file_attachment',
                            fileId: urlInfo.photo!.uuid,
                            fileMetadata: urlInfo.imageInfo!,
                            filePreview: urlInfo.photoPreview
                        };

                        await this.messaging.editMessage(
                            ctx,
                            item.messageId,
                            { attachments: [fileAttachment], appendAttachments: true },
                            false
                        );
                    }
                });
                return;
            });
        }
    }

    onNewMessage = (ctx: Context, message: Message) => {
        if (this.resolveLinks(message).length > 0) {
            this.queue.pushWork(ctx, { messageId: message.id });
        }
    }

    onMessageUpdated = (ctx: Context, message: Message) => {
        if (this.resolveLinks(message).length > 0) {
            this.queue.pushWork(ctx, { messageId: message.id });
        }
    }

    private resolveLinks = (message: Message) => {
        if (!message || !message.text || message.augmentation === false || (message.augmentation && message.augmentation.type === 'intro')) {
            return [];
        }
        let urls = linkifyInstance.match(message.text);

        if (!urls) {
            return [];
        }

        return urls
            .filter(u => u.url.startsWith('http:') || u.url.startsWith('https:'))
            .map(u => ({ ...u, url: URL.parse(u.url).href! }));
    }
}
