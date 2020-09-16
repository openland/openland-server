import { UserDialogsRepository } from './UserDialogsRepository';
import 'reflect-metadata';
import { Store } from './../../openland-module-db/FDB';
import { testEnvironmentStart, testEnvironmentEnd } from 'openland-modules/testEnvironment';
import { container } from 'openland-modules/Modules.container';
import { UserStateRepository } from './UserStateRepository';
import { MessagingRepository } from './MessagingRepository';
import { DeliveryRepository } from './DeliveryRepository';
import { Context, createNamedContext } from '@openland/context';
import { ChatMetricsRepository } from './ChatMetricsRepository';
import { UserDialogMessageReadEvent, UserDialogMessageReceivedEvent } from 'openland-module-db/store';
import { loadUsersModule } from '../../openland-module-users/UsersModule.container';
import { UsersModule } from '../../openland-module-users/UsersModule';

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
        container.bind('UserDialogsRepository').to(UserDialogsRepository).inSingletonScope();
        container.bind(UsersModule).toSelf().inSingletonScope();
        loadUsersModule();

        ctx = createNamedContext('test');
        userStateRepo = container.get<UserStateRepository>('UserStateRepository');
        messagingRepo = container.get<MessagingRepository>('MessagingRepository');
        deliveryRepo = container.get<DeliveryRepository>('DeliveryRepository');
    });

    const sendMessage = async (cid: number, text: string) => {
        let m1 = await messagingRepo.createMessage(ctx, cid, 2, { message: text });
        await deliveryRepo.deliverMessageToUser(ctx, 2, m1.message);
        // let state = await Store.UserDialogEvent.user.query(ctx, 2, { limit: 1, reverse: true });
        let state = await Store.UserDialogEventStore.createStream(2, {batchSize: 1}).tail(ctx);
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
        let updates = await userStateRepo.zipUpdatesInBatchesAfterModern(ctx, 2, state || undefined);

        expect(updates).toBeDefined();
        expect(updates!.items.length).toBe(1);
        expect(updates!.cursor).toBe(state2!);
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

        let events = await userStateRepo.zipUpdatesInBatchesAfterModern(ctx, 2, stateFrom || undefined);

        expect(events).toBeDefined();
        expect(events!.items.length).toBe(4);

        expect((events!.items[0] as UserDialogMessageReceivedEvent).mid).toBe(message.id);
        expect((events!.items[0] as UserDialogMessageReceivedEvent).cid).toBe(1);
        expect(events!.items[0].type).toBe('userDialogMessageUpdatedEvent');

        expect((events!.items[1] as UserDialogMessageReadEvent).cid).toBe(1);
        expect(events!.items[1].type).toBe('userDialogMessageReadEvent');

        expect((events!.items[2] as UserDialogMessageReceivedEvent).mid).toBe(m2fromCid2.id);
        expect((events!.items[2] as UserDialogMessageReceivedEvent).cid).toBe(2);

        expect((events!.items[3] as UserDialogMessageReceivedEvent).mid).toBe(mid9Cid1.id);
        expect((events!.items[3] as UserDialogMessageReceivedEvent).cid).toBe(1);

        expect(events!.cursor).toBe(stateTo);
    });

});