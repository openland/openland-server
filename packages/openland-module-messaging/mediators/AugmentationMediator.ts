import { injectable } from 'inversify';
import linkify from 'linkify-it';
import tlds from 'tlds';
import { WorkQueue } from 'openland-module-workers/WorkQueue';
import { AllEntities, Message } from 'openland-module-db/schema';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import UrlInfoService from 'openland-module-messaging/workers/UrlInfoService';
import { MessagingRepository } from 'openland-module-messaging/repositories/MessagingRepository';
import { lazyInject } from 'openland-modules/Modules.container';

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
            let service = new UrlInfoService();
            this.queue.addWorker(async (item) => {
                let message = await this.entities.Message.findById(item.messageId);

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
                if (urlInfo.title) {
                    await this.messaging.editMessage(item.messageId, { urlAugmentation: urlInfo }, false);
                }
                return { result: 'ok' };
            });
        }
    }

    onNewMessage = async (message: Message) => {
        if (this.resolveLinks(message).length > 0) {
            await this.queue.pushWork({ messageId: message.id });
        }
    }

    onMessageUpdated = async (message: Message) => {
        if (this.resolveLinks(message).length > 0) {
            await this.queue.pushWork({ messageId: message.id });
        }
    }

    private resolveLinks = (message: Message) => {
        if (!message || !message.text) {
            return [];
        }
        let urls = linkifyInstance.match(message.text);

        if (!urls) {
            return [];
        }

        return urls.filter(u => u.url.startsWith('http:') || u.url.startsWith('https:'));
    }
}