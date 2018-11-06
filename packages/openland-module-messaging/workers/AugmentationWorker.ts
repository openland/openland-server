
import linkify from 'linkify-it';
import tlds from 'tlds';
import { Services } from '../../openland-server/services';
import { WorkQueue } from 'openland-module-workers/WorkQueue';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { inTx } from 'foundation-orm/inTx';
import { Modules } from 'openland-modules/Modules';
import { FDB } from 'openland-module-db/FDB';

const linkifyInstance = linkify()
    .tlds(tlds)
    .tlds('onion', true);

export function createAugmentationWorker() {
    let queue = new WorkQueue<{ messageId: number }, { result: string }>('conversation_message_task');
    if (serverRoleEnabled('workers')) {
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

            let urlInfo = await Services.URLInfo.fetchURLInfo(firstUrl.url);

            if (urlInfo.title) {
                let members = await Modules.Messaging.conv.findConversationMembers(message.cid);

                await inTx(async () => {
                    let message2 = await FDB.Message.findById(item.messageId);
                    message2!.augmentation = urlInfo as any;

                    for (let member of members) {

                        let global = await Modules.Messaging.repo.getUserMessagingState(member);
                        global.seq++;
                        await FDB.UserDialogEvent.create(member, global.seq, {
                            kind: 'message_updated',
                            mid: message!.id
                        });

                    }

                    let seq = await Modules.Messaging.repo.fetchConversationNextSeq(message!.cid);
                    await FDB.ConversationEvent.create(message!.cid, seq, { kind: 'message_updated', mid: message!.id });
                });

                return { result: 'ok' };
            }

            return { result: 'ok' };
        });
    }
    return queue;
}