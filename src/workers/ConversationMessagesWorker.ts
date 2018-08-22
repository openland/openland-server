import { WorkQueue } from '../modules/workerQueue';
import { DB } from '../tables';
import linkify from 'linkify-it';
import tlds from 'tlds';
import { Services } from '../services';

const linkifyInstance = linkify()
    .tlds(tlds)
    .tlds('onion', true);

export function createConversationMessagesWorker() {
    let queue = new WorkQueue<{ messageId: number }, { result: string }>('conversation_message_task');
    queue.addWorker(async (item) => {
        let message = await DB.ConversationMessage.findById(item.messageId);

        if (!message || !message.message) {
            return { result: 'ok' };
        }

        let urls = linkifyInstance.match(message.message).filter(u => u.url.startsWith('http:') || u.url.startsWith('https:'));

        let firstUrl = urls[0];

        let urlInfo = await Services.URLInfo.fetchURLInfo(firstUrl.url);

        if (urlInfo.title) {
            message.extras.urlAugmentation = urlInfo as any;
            (message as any).changed('extras', true);
            await message.save();
        }

        return { result: 'ok' };
    });
    return queue;
}