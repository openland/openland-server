import { UpdateReader } from 'openland-server/modules/updateReader';
import { DB } from 'openland-server/tables';

export function createDeliveryWorker() {
    let reader = new UpdateReader('message-delivery-2', 1, DB.ConversationEvent);
    reader.processor(async (items) => {
        for (let i of items) {
            console.log(i.eventType);
        }
    });
    reader.start();
}