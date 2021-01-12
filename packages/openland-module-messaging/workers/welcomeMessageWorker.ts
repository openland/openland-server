import { WorkQueue } from '../../openland-module-workers/WorkQueue';
import { serverRoleEnabled } from '../../openland-utils/serverRoleEnabled';
import { Modules } from '../../openland-modules/Modules';
import { inTx } from '@openland/foundationdb';

export function createWelcomeMessageWorker() {
    let queue = new WorkQueue<{ cid: number, uid: number }>('welcome_message');
    if (serverRoleEnabled('workers')) {
        for (let i = 0; i < 10; i++) {
            queue.addWorker(async (task, root) => {
                return await inTx(root, async ctx => {
                    const welcomeMessage = await Modules.Messaging.room.resolveConversationWelcomeMessage(ctx, task.cid);
                    if (welcomeMessage && welcomeMessage.isOn && welcomeMessage.sender) {
                        const conv = await Modules.Messaging.room.resolvePrivateChat(ctx, welcomeMessage.sender.id, task.uid);
                        if (conv && welcomeMessage.message.trim().length !== 0) {
                            await Modules.Messaging.sendMessage(ctx, conv.id, welcomeMessage.sender.id, {
                                message: welcomeMessage.message,
                                visibleOnlyForUids: [task.uid]
                            });
                        }
                    }
                });
            });
        }
    }
    return queue;
}