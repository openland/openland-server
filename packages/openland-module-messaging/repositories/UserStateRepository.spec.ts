import 'reflect-metadata';
import { testEnvironmentStart, testEnvironmentEnd } from 'openland-modules/testEnvironment';
import { container } from 'openland-modules/Modules.container';
import { UserStateRepository } from './UserStateRepository';
import { createEmptyContext, Context } from 'openland-utils/Context';
import { MessagingRepository } from './MessagingRepository';
import { UserDialogEvent, AllEntities } from 'openland-module-db/schema';
import { DeliveryRepository } from './DeliveryRepository';

describe('UserStateRepository', () => {
    let ctx: Context;
    let userStateRepo: UserStateRepository;
    let messagingRepo: MessagingRepository;
    let deliveryRepo: DeliveryRepository;
    let entities: AllEntities;
    beforeAll(async () => {
        await testEnvironmentStart('user-state');
        container.bind('UserStateRepository').to(UserStateRepository).inSingletonScope();
        container.bind('MessagingRepository').to(MessagingRepository).inSingletonScope();
        container.bind('DeliveryRepository').to(DeliveryRepository).inSingletonScope();

        ctx = createEmptyContext();
        userStateRepo = container.get<UserStateRepository>('UserStateRepository');
        messagingRepo = container.get<MessagingRepository>('MessagingRepository');
        deliveryRepo = container.get<DeliveryRepository>('DeliveryRepository');
        entities = container.get<AllEntities>('FDB');

    });
    const sendMessage = async (cid: number, text: string) => {
        let m1 = await messagingRepo.createMessage(ctx, cid, 2, { message: text });
        await deliveryRepo.deliverMessageToUser(ctx, 2, m1.message.id);
        let state = await entities.UserDialogEvent.rangeFromUserWithCursor(ctx, 2, 1, undefined, true);
        return { mid: m1.message.id, state };
    };

    afterAll(() => {
        testEnvironmentEnd();
    });
    it('should correctly handle messaging state', async () => {
        let repo = container.get<UserStateRepository>('UserStateRepository');
        let state = await repo.getUserDialogState(ctx, 1, 2);
        expect(state.uid).toBe(1);
        expect(state.cid).toBe(2);
        expect(state.date).toBeNull();
        expect(state.readMessageId).toBeNull();
        expect(state.unread).toBe(0);
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

        let batch;
        for await (let b of iterator) {
            batch = b;
        }
        expect(batch).toBeDefined();
        expect(batch!.items.length).toBe(1);
        expect(batch!.cursor).toBe(state2.cursor);
    });

    it('should zip updates currectly', async () => {

        // messages to chat 1
        let { mid, state: stateFrom } = await sendMessage(1, '4');
        await sendMessage(1, '5');
        await sendMessage(1, '6');

        // edit message from chat 1
        await messagingRepo.editMessage(ctx, mid, { message: 'kek' }, false);
        await deliveryRepo.deliverMessageUpdateToUser(ctx, 2, mid);

        // more messages to chat 1
        await sendMessage(1, '7');
        let { mid: mid8Cid1 } = await sendMessage(1, '8');

        // read chat 1
        await deliveryRepo.deliverMessageReadToUser(ctx, 2, mid8Cid1, 8);

        // messages to chat 2
        await sendMessage(2, '1');
        let { mid: m2fromCid2 } = await sendMessage(2, '2');

        // one more message to chat 1
        let { mid: mid9Cid1, state: stateTo } = await sendMessage(1, '9');

        let iterator = await userStateRepo.zipUpdatesInBatchesAfter(ctx, 2, stateFrom.cursor);

        let batch: { items: UserDialogEvent[], cursor: string } | undefined;
        for await (let b of iterator) {
            batch = b;
        }
        expect(batch).toBeDefined();
        expect(batch!.items.length).toBe(4);

        expect(batch!.items[0].mid).toBe(mid);
        expect(batch!.items[0].cid).toBe(1);
        expect(batch!.items[0].kind).toBe('message_updated');

        expect(batch!.items[1].cid).toBe(1);
        expect(batch!.items[1].kind).toBe('message_read');

        expect(batch!.items[2].mid).toBe(m2fromCid2);
        expect(batch!.items[2].cid).toBe(2);

        expect(batch!.items[3].mid).toBe(mid9Cid1);
        expect(batch!.items[3].cid).toBe(1);

        expect(batch!.cursor).toBe(stateTo.cursor);
    });

});