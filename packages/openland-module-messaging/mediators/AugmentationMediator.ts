import { injectable } from 'inversify';
import { WorkQueue } from 'openland-module-workers/WorkQueue';
import { AllEntities, Message } from 'openland-module-db/schema';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { createUrlInfoService } from 'openland-module-messaging/workers/UrlInfoService';
import { MessagingRepository } from 'openland-module-messaging/repositories/MessagingRepository';
import { lazyInject } from 'openland-modules/Modules.container';
import { MessageAttachmentFileInput, MessageRichAttachmentInput } from '../MessageInput';
import { createLinkifyInstance } from '../../openland-utils/createLinkifyInstance';
import { Context } from '@openland/context';

const linkifyInstance = createLinkifyInstance();

@injectable()
export class AugmentationMediator {
    private readonly queue = new WorkQueue<{ messageId: number }, { result: string }>('conversation_message_task');

    @lazyInject('FDB') private readonly entities!: AllEntities;
    @lazyInject('MessagingRepository') private readonly messaging!: MessagingRepository;

    private started = false;

    start = () => {
        if (this.started) {
            return;
        }
        this.started = true;

        if (serverRoleEnabled('workers')) {
            let service = createUrlInfoService();
            this.queue.addWorker(async (item, ctx) => {
                let message = await this.entities.Message.findById(ctx, item.messageId);

                if (!message || !message.text) {
                    return { result: 'ok' };
                }

                // augmentation exists or was deleted
                if (message.augmentation) {
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
                        filePreview: null
                    };

                    await this.messaging.editMessage(
                        ctx,
                        item.messageId,
                        { attachments: [fileAttachment], appendAttachments: true },
                        false
                    );
                }
                return { result: 'ok' };
            });
        }
    }

    onNewMessage = async (ctx: Context, message: Message) => {
        if (this.resolveLinks(message).length > 0) {
            await this.queue.pushWork(ctx, { messageId: message.id });
        }
    }

    onMessageUpdated = async (ctx: Context, message: Message) => {
        if (this.resolveLinks(message).length > 0) {
            await this.queue.pushWork(ctx, { messageId: message.id });
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

        return urls.filter(u => u.url.startsWith('http:') || u.url.startsWith('https:'));
    }
}