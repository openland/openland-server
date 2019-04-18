import { injectable } from 'inversify';
import linkify from 'linkify-it';
import tlds from 'tlds';
import { WorkQueue } from 'openland-module-workers/WorkQueue';
import { AllEntities, Message } from 'openland-module-db/schema';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { createUrlInfoService } from 'openland-module-messaging/workers/UrlInfoService';
import { MessagingRepository } from 'openland-module-messaging/repositories/MessagingRepository';
import { lazyInject } from 'openland-modules/Modules.container';
import { createEmptyContext, Context } from 'openland-utils/Context';
import { MessageAttachmentFileInput, MessageRichAttachmentInput } from '../MessageInput';

const linkifyInstance = linkify()
    .tlds(tlds)
    .tlds('onion', true);

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
            this.queue.addWorker(async (item) => {
                let message = await this.entities.Message.findById(createEmptyContext(), item.messageId);

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

                if (urlInfo.type === 'none') {
                    return { result: 'ok' };
                }

                if (!urlInfo.title && !urlInfo.description && !urlInfo.imageInfo) {
                    return { result: 'ok' };
                }

                if (
                    (urlInfo.title && urlInfo.description) ||
                    urlInfo.type !== 'url'
                ) {
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
                        createEmptyContext(),
                        item.messageId,
                        { attachments: [richAttachment] },
                        false
                    );
                } else if (urlInfo.imageInfo) {
                    let fileAttachment: MessageAttachmentFileInput = {
                        type: 'file_attachment',
                        fileId: urlInfo.photo!.uuid,
                        fileMetadata: urlInfo.imageInfo!,
                        filePreview: null
                    };

                    await this.messaging.editMessage(
                        createEmptyContext(),
                        item.messageId,
                        { attachments: [fileAttachment] },
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