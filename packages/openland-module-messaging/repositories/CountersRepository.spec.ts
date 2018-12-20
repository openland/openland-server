import { testEnvironmentStart, testEnvironmentEnd } from 'openland-modules/testEnvironment';
import { container } from 'openland-modules/Modules.container';
import { UserStateRepository } from './UserStateRepository';
import { CountersRepository } from './CountersRepository';
import { MessagingRepository } from './MessagingRepository';
import { createEmptyContext } from 'openland-utils/Context';
import { UserRepository } from 'openland-module-users/repositories/UserRepository';

describe('CountersRepository', () => {
    beforeAll(async () => {
        await testEnvironmentStart('counters');
        container.bind('UserStateRepository').to(UserStateRepository).inSingletonScope();
        container.bind('CountersRepository').to(CountersRepository).inSingletonScope();
        container.bind('MessagingRepository').to(MessagingRepository).inSingletonScope();
        container.bind('UserRepository').to(UserRepository).inSingletonScope();
    });
    afterAll(() => {
        testEnvironmentEnd();
    });
    it('should increment counter and decrement', async () => {
        let ctx = createEmptyContext();
        let urepo = container.get<UserStateRepository>('UserStateRepository');
        let mrepo = container.get<MessagingRepository>('MessagingRepository');
        let repo = container.get<CountersRepository>('CountersRepository');

        let mid1 = (await mrepo.createMessage(ctx, 1, 1, { message: '1' })).message.id!;
        let mid2 = (await mrepo.createMessage(ctx, 1, 1, { message: '1' })).message.id!;
        let mid3 = (await mrepo.createMessage(ctx, 1, 1, { message: '1' })).message.id!;
        // Sender
        expect(await repo.onMessageReceived(ctx, 1, mid1)).toBe(0);
        expect(await repo.onMessageReceived(ctx, 1, mid2)).toBe(0);
        expect(await repo.onMessageReceived(ctx, 1, mid3)).toBe(0);
        // Receiver
        expect(await repo.onMessageReceived(ctx, 2, mid1)).toBe(1);
        expect(await repo.onMessageReceived(ctx, 2, mid2)).toBe(1);
        expect(await repo.onMessageReceived(ctx, 2, mid3)).toBe(1);

        let senderState = await urepo.getUserDialogState(ctx, 1, 1);
        let senderGlobal = await urepo.getUserMessagingState(ctx, 1);
        let receiverState = await urepo.getUserDialogState(ctx, 2, 1);
        let receiverGlobal = await urepo.getUserMessagingState(ctx, 2);

        expect(senderState.unread).toBe(0);
        expect(receiverState.unread).toBe(3);
        expect(senderGlobal.unread).toBe(0);
        expect(receiverGlobal.unread).toBe(3);

        // Read
        expect(await repo.onMessageRead(ctx, 2, mid3)).toBe(-3);
        expect(await repo.onMessageRead(ctx, 1, mid3)).toBe(0);
    });

    it('should be order-independent', async () => {
        let ctx = createEmptyContext();
        let urepo = container.get<UserStateRepository>('UserStateRepository');
        let mrepo = container.get<MessagingRepository>('MessagingRepository');
        let repo = container.get<CountersRepository>('CountersRepository');

        let mid1 = (await mrepo.createMessage(ctx, 2, 1, { message: '1' })).message.id!;
        let mid2 = (await mrepo.createMessage(ctx, 2, 1, { message: '1' })).message.id!;
        let mid3 = (await mrepo.createMessage(ctx, 2, 1, { message: '1' })).message.id!;

        expect(await repo.onMessageReceived(ctx, 2, mid1)).toBe(1);
        expect(await repo.onMessageRead(ctx, 2, mid3)).toBe(-1);
        expect(await repo.onMessageReceived(ctx, 2, mid2)).toBe(0);
        expect(await repo.onMessageReceived(ctx, 2, mid3)).toBe(0);

        let receiverState = await urepo.getUserDialogState(ctx, 2, 2);
        expect(receiverState.unread).toBe(0);
        expect(receiverState.readMessageId).toBe(mid3);
    });

    it('should be tolerant to double invoke', async () => {
        let ctx = createEmptyContext();
        let urepo = container.get<UserStateRepository>('UserStateRepository');
        let mrepo = container.get<MessagingRepository>('MessagingRepository');
        let repo = container.get<CountersRepository>('CountersRepository');

        let mid1 = (await mrepo.createMessage(ctx, 3, 1, { message: '1' })).message.id!;
        let mid2 = (await mrepo.createMessage(ctx, 3, 1, { message: '1' })).message.id!;
        let mid3 = (await mrepo.createMessage(ctx, 3, 1, { message: '1' })).message.id!;

        expect(await repo.onMessageReceived(ctx, 3, mid1)).toBe(1);
        expect(await repo.onMessageReceived(ctx, 3, mid1)).toBe(0);
        expect(await repo.onMessageRead(ctx, 3, mid3)).toBe(-1);
        expect(await repo.onMessageReceived(ctx, 3, mid2)).toBe(0);
        expect(await repo.onMessageReceived(ctx, 3, mid3)).toBe(0);

        let receiverState = await urepo.getUserDialogState(ctx, 3, 3);
        expect(receiverState.unread).toBe(0);
    });

    it('should decrement counter on unread message deletion', async () => {
        let ctx = createEmptyContext();
        let urepo = container.get<UserStateRepository>('UserStateRepository');
        let mrepo = container.get<MessagingRepository>('MessagingRepository');
        let repo = container.get<CountersRepository>('CountersRepository');

        let mid1 = (await mrepo.createMessage(ctx, 4, 1, { message: '1' })).message.id!;
        let mid2 = (await mrepo.createMessage(ctx, 4, 1, { message: '1' })).message.id!;
        let mid3 = (await mrepo.createMessage(ctx, 4, 1, { message: '1' })).message.id!;

        expect(await repo.onMessageReceived(ctx, 3, mid1)).toBe(1);
        expect(await repo.onMessageRead(ctx, 3, mid1)).toBe(-1);
        expect(await repo.onMessageDeleted(ctx, 3, mid1)).toBe(0); // Should ignore if already read

        expect(await repo.onMessageReceived(ctx, 3, mid2)).toBe(1);
        expect(await repo.onMessageDeleted(ctx, 3, mid2)).toBe(-1);
        expect(await repo.onMessageReceived(ctx, 3, mid3)).toBe(1);

        let receiverState = await urepo.getUserDialogState(ctx, 3, 4);
        expect(receiverState.unread).toBe(1);
    });
});