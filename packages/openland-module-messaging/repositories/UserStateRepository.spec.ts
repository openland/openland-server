import 'reflect-metadata';
import { Store } from './../../openland-module-db/FDB';
import { testEnvironmentStart, testEnvironmentEnd } from 'openland-modules/testEnvironment';
import { container } from 'openland-modules/Modules.container';
import { UserStateRepository } from './UserStateRepository';
import { MessagingRepository } from './MessagingRepository';
import { DeliveryRepository } from './DeliveryRepository';
import { Context, createNamedContext } from '@openland/context';
import { ChatMetricsRepository } from './ChatMetricsRepository';
import { UserDialogEvent } from 'openland-module-db/store';

describe('UserStateRepository', () => {
    let ctx: Context;
    let userStateRepo: UserStateRepository;
    let messagingRepo: MessagingRepository;
    let deliveryRepo: DeliveryRepository;

    beforeAll(async () => {
        await testEnvironmentStart('user-state');
        container.bind('UserStateRepository').to(UserStateRepository).inSingletonScope();
        container.bind('MessagingRepository').to(MessagingRepository).inSingletonScope();
        container.bind('DeliveryRepository').to(DeliveryRepository).inSingletonScope();
        container.bind('ChatMetricsRepository').to(ChatMetricsRepository).inSingletonScope();

        ctx = createNamedContext('test');
        userStateRepo = container.get<UserStateRepository>('UserStateRepository');
        messagingRepo = container.get<MessagingRepository>('MessagingRepository');
        deliveryRepo = container.get<DeliveryRepository>('DeliveryRepository');
    });

    const sendMessage = async (cid: number, text: string) => {
        let m1 = await messagingRepo.createMessage(ctx, cid, 2, { message: text });
        await deliveryRepo.deliverMessageToUser(ctx, 2, m1.message);
        let state = await Store.UserDialogEvent.user.query(ctx, 2, { limit: 1, reverse: true });
        return { message: m1.message, state };
    };

    afterAll(async () => {
        await testEnvironmentEnd();
    });
    it('should correctly handle messaging state', async () => {
        let repo = container.get<UserStateRepository>('UserStateRepository');
        let state = await repo.getUserDialogState(ctx, 1, 2);
        expect(state.uid).toBe(1);
        expect(state.cid).toBe(2);
        expect(state.date).toBeNull();
        expect(state.readMessageId).toBeNull();
    });

    it('should not zip updates for initial dialog load', async () => {
        await sendMessage(1, '1');
        let iterator = await userStateRepo.zipUpdatesInBatchesAfter(ctx, 2, undefined);
        let batch;
        for await (let b of iterator) {
            batch = b;
        }
        expect(batch).toBe(undefined);

    });

    it('should handle old updates then return last state to subscribe for live updates', async () => {
        let { state } = await sendMessage(1, '2');
        let { state: state2 } = await sendMessage(1, '3');
        let iterator = await userStateRepo.zipUpdatesInBatchesAfter(ctx, 2, state.cursor);

        let batch: any;
        for await (let b of iterator) {
            batch = b;
        }
        expect(batch).toBeDefined();
        expect(batch!.items.length).toBe(1);
        expect(batch!.cursor).toBe(state2.cursor);
    });

    it('should zip updates currectly', async () => {

        // messages to chat 1
        let { message, state: stateFrom } = await sendMessage(1, '4');
        await sendMessage(1, '5');
        await sendMessage(1, '6');

        // edit message from chat 1
        await messagingRepo.editMessage(ctx, message.id, { message: 'kek' }, false);
        await deliveryRepo.deliverMessageUpdateToUser(ctx, 2, message);

        // more messages to chat 1
        await sendMessage(1, '7');
        let { message: mid8Cid1 } = await sendMessage(1, '8');

        // read chat 1
        await deliveryRepo.deliverMessageReadToUser(ctx, 2, mid8Cid1.id);

        // messages to chat 2
        await sendMessage(2, '1');
        let { message: m2fromCid2 } = await sendMessage(2, '2');

        // one more message to chat 1
        let { message: mid9Cid1, state: stateTo } = await sendMessage(1, '9');

        let iterator = await userStateRepo.zipUpdatesInBatchesAfter(ctx, 2, stateFrom.cursor);

        let batch: { items: UserDialogEvent[], cursor: string } | undefined;
        for await (let b of iterator) {
            batch = b;
        }
        expect(batch).toBeDefined();
        expect(batch!.items.length).toBe(4);

        expect(batch!.items[0].mid).toBe(message.id);
        expect(batch!.items[0].cid).toBe(1);
        expect(batch!.items[0].kind).toBe('message_updated');

        expect(batch!.items[1].cid).toBe(1);
        expect(batch!.items[1].kind).toBe('message_read');

        expect(batch!.items[2].mid).toBe(m2fromCid2.id);
        expect(batch!.items[2].cid).toBe(2);

        expect(batch!.items[3].mid).toBe(mid9Cid1.id);
        expect(batch!.items[3].cid).toBe(1);

        expect(batch!.cursor).toBe(stateTo.cursor);
    });

});