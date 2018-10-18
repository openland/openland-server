import { WorkQueue } from '../modules/workerQueue';
import { DB } from '../tables';
import linkify from 'linkify-it';
import tlds from 'tlds';
import { Services } from '../services';
import { Repos } from '../repositories';

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

        // augmentation exists or was deleted
        if (message.extras.urlAugmentation || message.extras.urlAugmentation === null) {
            return { result: 'ok' };
        }

        let urls = linkifyInstance.match(message.message);

        if (!urls) {
            return { result: 'ok' };
        }

        urls = urls.filter(u => u.url.startsWith('http:') || u.url.startsWith('https:'));

        if (urls.length === 0) {
            return { result: 'ok' };
        }

        let firstUrl = urls[0];

        let urlInfo = await Services.URLInfo.fetchURLInfo(firstUrl.url);

        if (urlInfo.title) {
            await DB.txStable(async (tx) => {
                if (!message || !message.message) {
                    return { result: 'ok' };
                }

                message!.extras.urlAugmentation = urlInfo as any;
                (message as any).changed('extras', true);
                await message.save();

                await Repos.Chats.addUserEventsInConversation(
                    message.conversationId,
                    message.userId,
                    'edit_message',
                    {
                        messageId: message.id
                    },
                    tx
                );

                return await Repos.Chats.addChatEvent(
                    message.conversationId,
                    'edit_message',
                    {
                        messageId: message.id
                    },
                    tx
                );
            });
        }

        return { result: 'ok' };
    });
    return queue;
}