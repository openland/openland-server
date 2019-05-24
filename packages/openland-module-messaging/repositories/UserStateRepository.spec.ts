import 'reflect-metadata';
import { testEnvironmentStart, testEnvironmentEnd } from 'openland-modules/testEnvironment';
import { container } from 'openland-modules/Modules.container';
import { UserStateRepository } from './UserStateRepository';
import { createEmptyContext } from 'openland-utils/Context';
import { MessagingRepository } from './MessagingRepository';
import { UserDialogEvent, AllEntities } from 'openland-module-db/schema';
import { DeliveryRepository } from './DeliveryRepository';

describe('UserStateRepository', () => {
    beforeAll(async () => {
        await testEnvironmentStart('user-state');
        container.bind('UserStateRepository').to(UserStateRepository).inSingletonScope();
        container.bind('MessagingRepository').to(MessagingRepository).inSingletonScope();
        container.bind('DeliveryRepository').to(DeliveryRepository).inSingletonScope();

    });
    afterAll(() => {
        testEnvironmentEnd();
    });
    it('should correctly handle messaging state', async () => {
        let ctx = createEmptyContext();
        let repo = container.get<UserStateRepository>('UserStateRepository');
        let state = await repo.getUserDialogState(ctx, 1, 2);
        expect(state.uid).toBe(1);
        expect(state.cid).toBe(2);
        expect(state.date).toBeNull();
        expect(state.readMessageId).toBeNull();
        expect(state.unread).toBe(0);
    });

    it('should zip dialog updates correctly', async () => {
        let ctx = createEmptyContext();
        let userStateRepo = container.get<UserStateRepository>('UserStateRepository');
        let messagingRepo = container.get<MessagingRepository>('MessagingRepository');
        let deliveryRepo = container.get<DeliveryRepository>('DeliveryRepository');
        let entities = container.get<AllEntities>('FDB');

        let batch: { items: UserDialogEvent[], cursor: string, fromSeq: number } | undefined = undefined;
        let iterator = await userStateRepo.zipUpdatesInBatchesAfter(ctx, 2, undefined);
        let state: string | undefined = undefined;
        for await (let u of iterator) {
            state = u.cursor;
        }

        expect(batch).toBe(undefined);
        expect(state).toBe(undefined);

        // 1 message
        // send message
        let m1 = await messagingRepo.createMessage(ctx, 1, 2, { message: '1' });
        await deliveryRepo.deliverMessageToUser(ctx, 2, m1.message.id);
        let lastDialogUpdate = await entities.UserDialogEvent.rangeFromUserWithCursor(ctx, 2, 1);
        state = lastDialogUpdate.openCursor;
        let m1v1 = await messagingRepo.createMessage(ctx, 1, 2, { message: '2' });
        await deliveryRepo.deliverMessageToUser(ctx, 2, m1v1.message.id);

        // throw new Error(state);
        iterator = await userStateRepo.zipUpdatesInBatchesAfter(ctx, 2, state);
        state = undefined;
        for await (let u of iterator) {
            batch = u;
            state = u.cursor;
        }
        lastDialogUpdate = await entities.UserDialogEvent.rangeFromUserWithCursor(ctx, 2, 1, undefined, true);

        expect(batch).toBeDefined();
        expect(batch!.cursor).toBe(lastDialogUpdate.openCursor);
        expect(batch!.fromSeq).toBe(lastDialogUpdate.items[0].seq);

        //
        // several messages, zipping
        //
        // send messages
        let m2 = await messagingRepo.createMessage(ctx, 1, 2, { message: '2' });
        await deliveryRepo.deliverMessageToUser(ctx, 2, m2.message.id);
        let m3 = await messagingRepo.createMessage(ctx, 1, 2, { message: '3' });
        await deliveryRepo.deliverMessageToUser(ctx, 2, m3.message.id);
        let m4 = await messagingRepo.createMessage(ctx, 1, 2, { message: '4' });
        await deliveryRepo.deliverMessageToUser(ctx, 2, m4.message.id);

        iterator = await userStateRepo.zipUpdatesInBatchesAfter(ctx, 2, state);
        let prevState = state;
        for await (let u of iterator) {
            batch = u;
            state = u.cursor;
        }
        let rawUpdates = await entities.UserDialogEvent.rangeFromUserWithCursor(ctx, 2, Number.MAX_SAFE_INTEGER, prevState);

        expect(batch).toBeDefined();
        expect(batch!.cursor).toBe(rawUpdates.openCursor);
        expect(batch!.fromSeq).toBe(rawUpdates.items[0].seq);
        expect(batch!.items.length).toBe(1);
        expect(batch!.items[0].mid).toBe(m4.message.id);

        //
        // several messages, not loozing
        //
        // send messages
        let m11 = await messagingRepo.createMessage(ctx, 1, 2, { message: '1_1' });
        await deliveryRepo.deliverMessageToUser(ctx, 2, m11.message.id);

        let m21 = await messagingRepo.createMessage(ctx, 2, 2, { message: '2_1' });
        await deliveryRepo.deliverMessageToUser(ctx, 2, m21.message.id);

        let m12 = await messagingRepo.createMessage(ctx, 1, 2, { message: '1_2' });
        await deliveryRepo.deliverMessageToUser(ctx, 2, m12.message.id);

        let m22 = await messagingRepo.createMessage(ctx, 2, 2, { message: '2_2' });
        await deliveryRepo.deliverMessageToUser(ctx, 2, m22.message.id);

        iterator = await userStateRepo.zipUpdatesInBatchesAfter(ctx, 2, state);
        prevState = state;
        for await (let u of iterator) {
            batch = u;
            state = u.cursor;
        }
        rawUpdates = await entities.UserDialogEvent.rangeFromUserWithCursor(ctx, 2, Number.MAX_SAFE_INTEGER, prevState);

        expect(batch).toBeDefined();
        expect(batch!.cursor).toBe(rawUpdates.openCursor);
        expect(batch!.fromSeq).toBe(rawUpdates.items[0].seq);
        expect(batch!.items.length).toBe(2);
        expect(batch!.items[0].mid).toBe(m12.message.id);
        expect(batch!.items[1].mid).toBe(m22.message.id);

    });
});