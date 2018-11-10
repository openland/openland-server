
import linkify from 'linkify-it';
import tlds from 'tlds';
import { WorkQueue } from 'openland-module-workers/WorkQueue';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { Modules } from 'openland-modules/Modules';
import { FDB } from 'openland-module-db/FDB';
import UrlInfoService from './UrlInfoService';

const linkifyInstance = linkify()
    .tlds(tlds)
    .tlds('onion', true);

export function createAugmentationWorker() {
    let queue = new WorkQueue<{ messageId: number }, { result: string }>('conversation_message_task');
    if (serverRoleEnabled('workers')) {
        let service = new UrlInfoService();
        queue.addWorker(async (item) => {
            let message = await FDB.Message.findById(item.messageId);

            if (!message || !message.text) {
                return { result: 'ok' };
            }

            // augmentation exists or was deleted
            if (message.augmentation) {
                return { result: 'ok' };
            }

            let urls = linkifyInstance.match(message.text);

            if (!urls) {
                return { result: 'ok' };
            }

            urls = urls.filter(u => u.url.startsWith('http:') || u.url.startsWith('https:'));

            if (urls.length === 0) {
                return { result: 'ok' };
            }

            let firstUrl = urls[0];

            let urlInfo = await service.fetchURLInfo(firstUrl.url);

            if (urlInfo.title) {
                await Modules.Messaging.repo.editMessage(item.messageId, { urlAugmentation: urlInfo }, false);
            }

            return { result: 'ok' };
        });
    }
    return queue;
}