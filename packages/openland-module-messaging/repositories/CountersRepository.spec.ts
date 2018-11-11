import { testEnvironmentStart, testEnvironmentEnd } from 'openland-modules/testEnvironment';
import { container } from 'openland-modules/Modules.container';
import { UserStateRepository } from './UserStateRepository';
import { CountersRepository } from './CountersRepository';
import { MessagingRepository } from './MessagingRepository';

describe('CountersRepository', () => {
    beforeAll(async () => {
        await testEnvironmentStart('counters');
        container.bind('UserStateRepository').to(UserStateRepository).inSingletonScope();
        container.bind('CountersRepository').to(CountersRepository).inSingletonScope();
        container.bind('MessagingRepository').to(MessagingRepository).inSingletonScope();
    });
    afterAll(() => {
        testEnvironmentEnd();
    });
    it('should increment counter and decrement', async () => {
        let urepo = container.get<UserStateRepository>('UserStateRepository');
        let mrepo = container.get<MessagingRepository>('MessagingRepository');
        let repo = container.get<CountersRepository>('CountersRepository');
        
        let mid1 = (await mrepo.createMessage(1, 1, { message: '1' })).message.id!;
        let mid2 = (await mrepo.createMessage(1, 1, { message: '1' })).message.id!;
        let mid3 = (await mrepo.createMessage(1, 1, { message: '1' })).message.id!;
        // Sender
        expect(await repo.onMessageReceived(1, mid1)).toBe(0);
        expect(await repo.onMessageReceived(1, mid2)).toBe(0);
        expect(await repo.onMessageReceived(1, mid3)).toBe(0);
        // Receiver
        expect(await repo.onMessageReceived(2, mid1)).toBe(1);
        expect(await repo.onMessageReceived(2, mid2)).toBe(1);
        expect(await repo.onMessageReceived(2, mid3)).toBe(1);

        let senderState = await urepo.getUserDialogState(1, 1);
        let senderGlobal = await urepo.getUserMessagingState(1);
        let receiverState = await urepo.getUserDialogState(2, 1);
        let receiverGlobal = await urepo.getUserMessagingState(2);

        expect(senderState.unread).toBe(0);
        expect(receiverState.unread).toBe(3);
        expect(senderGlobal.unread).toBe(0);
        expect(receiverGlobal.unread).toBe(3);

        // Read
        expect(await repo.onMessageRead(2, mid3)).toBe(-3);
        expect(await repo.onMessageRead(1, mid3)).toBe(0);
    });

    it('should be order-independent', async () => {
        let urepo = container.get<UserStateRepository>('UserStateRepository');
        let mrepo = container.get<MessagingRepository>('MessagingRepository');
        let repo = container.get<CountersRepository>('CountersRepository');

        let mid1 = (await mrepo.createMessage(2, 1, { message: '1' })).message.id!;
        let mid2 = (await mrepo.createMessage(2, 1, { message: '1' })).message.id!;
        let mid3 = (await mrepo.createMessage(2, 1, { message: '1' })).message.id!;

        expect(await repo.onMessageReceived(2, mid1)).toBe(1);
        expect(await repo.onMessageRead(2, mid3)).toBe(-1);
        expect(await repo.onMessageReceived(2, mid2)).toBe(0);
        expect(await repo.onMessageReceived(2, mid3)).toBe(0);

        let receiverState = await urepo.getUserDialogState(2, 2);
        expect(receiverState.unread).toBe(0);
        expect(receiverState.readMessageId).toBe(mid3);
    });

    it('should be tolerant to double invoke', async () => {
        let urepo = container.get<UserStateRepository>('UserStateRepository');
        let mrepo = container.get<MessagingRepository>('MessagingRepository');
        let repo = container.get<CountersRepository>('CountersRepository');

        let mid1 = (await mrepo.createMessage(3, 1, { message: '1' })).message.id!;
        let mid2 = (await mrepo.createMessage(3, 1, { message: '1' })).message.id!;
        let mid3 = (await mrepo.createMessage(3, 1, { message: '1' })).message.id!;

        expect(await repo.onMessageReceived(3, mid1)).toBe(1);
        expect(await repo.onMessageReceived(3, mid1)).toBe(0);
        expect(await repo.onMessageRead(3, mid3)).toBe(-1);
        expect(await repo.onMessageReceived(3, mid2)).toBe(0);
        expect(await repo.onMessageReceived(3, mid3)).toBe(0);

        let receiverState = await urepo.getUserDialogState(3, 3);
        expect(receiverState.unread).toBe(0);
    });
});