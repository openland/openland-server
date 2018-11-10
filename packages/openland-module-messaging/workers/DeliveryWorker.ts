import { WorkQueue } from 'openland-module-workers/WorkQueue';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { Modules } from 'openland-modules/Modules';
import { createTracer } from 'openland-log/createTracer';
import { withTracing } from 'openland-log/withTracing';

const tracer = createTracer('message-delivery');

export function createDeliveryWorker() {
    let queue = new WorkQueue<{ messageId: number }, { result: string }>('conversation_message_delivery');
    if (serverRoleEnabled('delivery')) {
        queue.addWorker(async (item) => {
            await withTracing(tracer, 'delivery', async () => {
                await Modules.Messaging.dialogs.deliverMessage(item.messageId);
            });
            return { result: 'ok' };
        });
    }
    return queue;
}