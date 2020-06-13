import { Store } from './../../openland-module-db/FDB';
import { testEnvironmentStart, testEnvironmentEnd } from 'openland-modules/testEnvironment';
import { container } from 'openland-modules/Modules.container';
import { UserStateRepository } from './UserStateRepository';
import { CountersRepository } from './CountersRepository';
import { MessagingRepository } from './MessagingRepository';
import { loadMessagingTestModule } from '../Messaging.container.test';
import { createNamedContext } from '@openland/context';
import { loadUsersModule } from '../../openland-module-users/UsersModule.container';
import { UsersModule } from '../../openland-module-users/UsersModule';

describe('CountersRepository', () => {
    beforeAll(async () => {
        await testEnvironmentStart('counters');
        loadMessagingTestModule();
        // container.bind('UserStateRepository').to(UserStateRepository).inSingletonScope();
        // container.bind('CountersRepository').to(CountersRepository).inSingletonScope();
        // container.bind('MessagingRepository').to(MessagingRepository).inSingletonScope();
        container.bind(UsersModule).toSelf().inSingletonScope();
        loadUsersModule();
    }, 50000);
    afterAll(async () => {
        await testEnvironmentEnd();
    }, 50000);
    it('should increment counter and decrement', async () => {
        let ctx = createNamedContext('test');
        let urepo = container.get<UserStateRepository>('UserStateRepository');
        let mrepo = container.get<MessagingRepository>('MessagingRepository');
        let repo = container.get<CountersRepository>('CountersRepository');

        let mid1 = (await mrepo.createMessage(ctx, 1, 1, { message: '1' })).message;
        let mid2 = (await mrepo.createMessage(ctx, 1, 1, { message: '1' })).message;
        let mid3 = (await mrepo.createMessage(ctx, 1, 1, { message: '1' })).message;
        // Sender
        expect((await repo.onMessageReceived(ctx, 1, mid1)).delta).toBe(0);
        expect((await repo.onMessageReceived(ctx, 1, mid2)).delta).toBe(0);
        expect((await repo.onMessageReceived(ctx, 1, mid3)).delta).toBe(0);
        // Receiver
        expect((await repo.onMessageReceived(ctx, 2, mid1)).delta).toBe(1);
        expect((await repo.onMessageReceived(ctx, 2, mid2)).delta).toBe(1);
        expect((await repo.onMessageReceived(ctx, 2, mid3)).delta).toBe(1);

        let senderLocalCounter = await urepo.getUserMessagingDialogUnread(ctx, 1, 1);
        let senderGlobalCounter = await urepo.getUserMessagingUnread(ctx, 1);

        let receiverLocalCounter = await urepo.getUserMessagingDialogUnread(ctx, 2, 1);
        let receiverGlobalCounter = await urepo.getUserMessagingUnread(ctx, 2);

        expect(senderLocalCounter).toBe(0);

        expect(receiverLocalCounter).toBe(3);

        expect(senderGlobalCounter).toBe(0);
        expect(receiverGlobalCounter).toBe(3);

        // Read
        expect((await repo.onMessageRead(ctx, 2, mid3)).delta).toBe(-3);
        expect((await repo.onMessageRead(ctx, 1, mid3)).delta).toBe(0);
    }, 50000);

    it('should properly decrement on middle-read', async () => {
        let ctx = createNamedContext('test');
        let urepo = container.get<UserStateRepository>('UserStateRepository');
        let mrepo = container.get<MessagingRepository>('MessagingRepository');
        let repo = container.get<CountersRepository>('CountersRepository');

        let mid1 = (await mrepo.createMessage(ctx, 1, 1, { message: '1' })).message;
        let mid2 = (await mrepo.createMessage(ctx, 1, 1, { message: '1' })).message;
        let mid3 = (await mrepo.createMessage(ctx, 1, 1, { message: '1' })).message;
        let mid4 = (await mrepo.createMessage(ctx, 1, 1, { message: '1' })).message;
        let mid5 = (await mrepo.createMessage(ctx, 1, 1, { message: '1' })).message;
        let mid6 = (await mrepo.createMessage(ctx, 1, 1, { message: '1' })).message;
        // Receiver
        expect((await repo.onMessageReceived(ctx, 2, mid1)).delta).toBe(1);
        expect((await repo.onMessageReceived(ctx, 2, mid2)).delta).toBe(1);
        expect((await repo.onMessageReceived(ctx, 2, mid3)).delta).toBe(1);
        expect((await repo.onMessageReceived(ctx, 2, mid4)).delta).toBe(1);
        expect((await repo.onMessageReceived(ctx, 2, mid5)).delta).toBe(1);
        expect((await repo.onMessageReceived(ctx, 2, mid6)).delta).toBe(1);

        let receiverLocalCounter = await urepo.getUserMessagingDialogUnread(ctx, 2, 1);
        let receiverGlobalCounter = await urepo.getUserMessagingUnread(ctx, 2);

        expect(receiverLocalCounter).toBe(6);
        expect(receiverGlobalCounter).toBe(6);

        // Read
        expect((await repo.onMessageRead(ctx, 2, mid3)).delta).toBe(-3);

        receiverLocalCounter = await urepo.getUserMessagingDialogUnread(ctx, 2, 1);
        receiverGlobalCounter = await urepo.getUserMessagingUnread(ctx, 2);

        expect(receiverLocalCounter).toBe(3);
        expect(receiverGlobalCounter).toBe(3);
    }, 50000);

    it('should be order-independent', async () => {
        let ctx = createNamedContext('test');
        let urepo = container.get<UserStateRepository>('UserStateRepository');
        let mrepo = container.get<MessagingRepository>('MessagingRepository');
        let repo = container.get<CountersRepository>('CountersRepository');

        let mid1 = (await mrepo.createMessage(ctx, 2, 1, { message: '1' })).message;
        let mid2 = (await mrepo.createMessage(ctx, 2, 1, { message: '1' })).message;
        let mid3 = (await mrepo.createMessage(ctx, 2, 1, { message: '1' })).message;

        expect((await repo.onMessageReceived(ctx, 2, mid1)).delta).toBe(1);
        expect((await repo.onMessageRead(ctx, 2, mid3)).delta).toBe(-1);
        expect((await repo.onMessageReceived(ctx, 2, mid2)).delta).toBe(0);
        expect((await repo.onMessageReceived(ctx, 2, mid3)).delta).toBe(0);

        let receiverLocalCounter = await urepo.getUserMessagingDialogUnread(ctx, 2, 2);
        expect(receiverLocalCounter).toBe(0);
        expect(await Store.UserDialogReadMessageId.get(ctx, 2, 2)).toBe(mid3.id);
    }, 50000);

    // it('should be tolerant to double invoke', async () => {
    //     let ctx = createNamedContext('test')();
    //     let urepo = container.get<UserStateRepository>('UserStateRepository');
    //     let mrepo = container.get<MessagingRepository>('MessagingRepository');
    //     let repo = container.get<CountersRepository>('CountersRepository');

    //     let mid1 = (await mrepo.createMessage(ctx, 3, 1, { message: '1' })).message;
    //     let mid2 = (await mrepo.createMessage(ctx, 3, 1, { message: '1' })).message;
    //     let mid3 = (await mrepo.createMessage(ctx, 3, 1, { message: '1' })).message;

    //     expect((await repo.onMessageReceived(ctx, 3, mid1)).delta).toBe(1);
    //     expect((await repo.onMessageReceived(ctx, 3, mid1)).delta).toBe(0);
    //     expect((await repo.onMessageRead(ctx, 3, mid3.id)).delta).toBe(-1);
    //     expect((await repo.onMessageReceived(ctx, 3, mid2)).delta).toBe(0);
    //     expect((await repo.onMessageReceived(ctx, 3, mid3)).delta).toBe(0);

    //     let receiverState = await urepo.getUserDialogState(ctx, 3, 3);
    //     expect(receiverState.unread).toBe(0);
    // });

    it('should decrement counter on unread message deletion', async () => {
        let ctx = createNamedContext('test');
        let urepo = container.get<UserStateRepository>('UserStateRepository');
        let mrepo = container.get<MessagingRepository>('MessagingRepository');
        let repo = container.get<CountersRepository>('CountersRepository');

        let mid1 = (await mrepo.createMessage(ctx, 4, 1, { message: '1', spans: [{ type: 'user_mention', offset: 0, length: 1, user: 3 }] })).message;

        expect((await repo.onMessageReceived(ctx, 3, mid1)).delta).toBe(1);
        expect((await repo.onMessageRead(ctx, 3, mid1)).delta).toBe(-1);
        expect(await repo.onMessageDeleted(ctx, 3, mid1)).toBe(0); // Should ignore if already read

        let mid2 = (await mrepo.createMessage(ctx, 4, 1, { message: '1', spans: [{ type: 'user_mention', offset: 0, length: 1, user: 3 }] })).message;
        let mid3 = (await mrepo.createMessage(ctx, 4, 1, { message: '1' })).message;

        expect((await repo.onMessageReceived(ctx, 3, mid2)).delta).toBe(1);
        expect(await repo.onMessageDeleted(ctx, 3, mid2)).toBe(-1);
        expect((await repo.onMessageReceived(ctx, 3, mid3)).delta).toBe(1);

        let receiverHaveMention = await Store.UserDialogHaveMention.byId(3, 4).get(ctx);
        let receiverLocalCounter = await urepo.getUserMessagingDialogUnread(ctx, 3, 4);
        expect(receiverLocalCounter).toBe(1);
        expect(receiverHaveMention).toBe(false);
    }, 50000);

    it('should mark dialog mention for messages with mentions', async () => {
        let ctx = createNamedContext('test');
        let urepo = container.get<UserStateRepository>('UserStateRepository');
        let mrepo = container.get<MessagingRepository>('MessagingRepository');
        let repo = container.get<CountersRepository>('CountersRepository');

        let mid1 = (await mrepo.createMessage(ctx, 5, 1, { message: '1', spans: [{ type: 'user_mention', offset: 0, length: 1, user: 6 }] })).message;
        let mid2 = (await mrepo.createMessage(ctx, 5, 1, { message: '1' })).message;
        let mid3 = (await mrepo.createMessage(ctx, 5, 1, { message: '1', spans: [{ type: 'user_mention', offset: 0, length: 1, user: 6 }] })).message;

        // After fisrt mention
        expect((await repo.onMessageReceived(ctx, 6, mid1)).delta).toBe(1);
        // let receiverState = await urepo.getUserDialogState(ctx, 6, 5);
        let receiverHaveMention = await Store.UserDialogHaveMention.byId(6, 5).get(ctx);
        let receiverLocalCounter = await urepo.getUserMessagingDialogUnread(ctx, 6, 5);
        expect(receiverLocalCounter).toBe(1);
        expect(receiverHaveMention).toBe(true);

        // Second message without mention
        expect((await repo.onMessageReceived(ctx, 6, mid2)).delta).toBe(1);
        receiverHaveMention = await Store.UserDialogHaveMention.byId(6, 5).get(ctx);
        receiverLocalCounter = await urepo.getUserMessagingDialogUnread(ctx, 6, 5);
        expect(receiverLocalCounter).toBe(2);
        expect(receiverHaveMention).toBe(true);

        // Third message with mention again
        expect((await repo.onMessageReceived(ctx, 6, mid3)).delta).toBe(1);
        receiverHaveMention = await Store.UserDialogHaveMention.byId(6, 5).get(ctx);
        receiverLocalCounter = await urepo.getUserMessagingDialogUnread(ctx, 6, 5);
        expect(receiverLocalCounter).toBe(3);
        expect(receiverHaveMention).toBe(true);
    }, 50000);

    it('should clear mention flag on read', async () => {
        let ctx = createNamedContext('test');
        let urepo = container.get<UserStateRepository>('UserStateRepository');
        let mrepo = container.get<MessagingRepository>('MessagingRepository');
        let repo = container.get<CountersRepository>('CountersRepository');
        const CID = 7;
        const S_UID = 8;
        const R_UID = 9;
        let mid1 = (await mrepo.createMessage(ctx, CID, S_UID, { message: '1', spans: [{ type: 'user_mention', offset: 0, length: 1, user: R_UID }] })).message;

        // Should not reset mention as there are more messages
        expect((await repo.onMessageReceived(ctx, R_UID, mid1)).delta).toBe(1);
        let r = await repo.onMessageRead(ctx, R_UID, mid1);
        expect(r.delta).toBe(-1);
        expect(r.mentionReset).toBe(false);

        let mid2 = (await mrepo.createMessage(ctx, CID, S_UID, { message: '1' })).message;
        let mid3 = (await mrepo.createMessage(ctx, CID, S_UID, { message: '1', spans: [{ type: 'user_mention', offset: 0, length: 1, user: R_UID }] })).message;

        // Receive other
        expect((await repo.onMessageReceived(ctx, R_UID, mid2)).delta).toBe(1);
        expect((await repo.onMessageReceived(ctx, R_UID, mid3)).delta).toBe(1);

        // Read last
        r = await repo.onMessageRead(ctx, R_UID, mid3);
        expect(r.delta).toBe(-2);
        expect(r.mentionReset).toBe(true);

        // Result state
        let receiverHaveMention = await Store.UserDialogHaveMention.byId(R_UID, CID).get(ctx);
        let receiverLocalCounter = await urepo.getUserMessagingDialogUnread(ctx, R_UID, CID);
        expect(receiverLocalCounter).toBe(0);
        expect(receiverHaveMention).toBe(false);
    }, 50000);

    // it('should not increment global counter for muted chat', async () => {
    //     await inTx(createNamedContext('test')(), async ctx => {
    //         let urepo = container.get<UserStateRepository>('UserStateRepository');
    //         let mrepo = container.get<MessagingRepository>('MessagingRepository');
    //         let repo = container.get<CountersRepository>('CountersRepository');
    //
    //         const muteChat = async (uid: number, cid: number) => {
    //             let settings = await Modules.Messaging.getRoomSettings(ctx, uid, cid);
    //             await repo.onDialogMuteChange(ctx, uid, cid, true);
    //             settings.mute = true;
    //             await settings.flush();
    //         };
    //         let UID = 77;
    //
    //         let mid1 = (await mrepo.createMessage(ctx, 1, 1, { message: '1' })).message.id!;
    //         let mid2 = (await mrepo.createMessage(ctx, 1, 1, { message: '1' })).message.id!;
    //         let mid3 = (await mrepo.createMessage(ctx, 1, 1, { message: '1' })).message.id!;
    //         expect((await repo.onMessageReceived(ctx, UID, mid1)).delta).toBe(1);
    //         expect((await repo.onMessageReceived(ctx, UID, mid2)).delta).toBe(1);
    //         expect((await repo.onMessageReceived(ctx, UID, mid3)).delta).toBe(1);
    //
    //         let receiverState = await urepo.getUserDialogState(ctx, UID, 1);
    //         let receiverGlobal = await urepo.getUserMessagingState(ctx, UID);
    //
    //         expect(receiverState.unread).toBe(3);
    //         expect(receiverGlobal.unread).toBe(3);
    //
    //         await muteChat(UID, 1);
    //
    //         let mid4 = (await mrepo.createMessage(ctx, 1, 1, { message: '1' })).message.id!;
    //         let mid5 = (await mrepo.createMessage(ctx, 1, 1, { message: '1' })).message.id!;
    //         let mid6 = (await mrepo.createMessage(ctx, 1, 1, { message: '1' })).message.id!;
    //         expect((await repo.onMessageReceived(ctx, UID, mid4)).delta).toBe(1);
    //         expect((await repo.onMessageReceived(ctx, UID, mid5)).delta).toBe(1);
    //         expect((await repo.onMessageReceived(ctx, UID, mid6)).delta).toBe(1);
    //
    //         receiverState = await urepo.getUserDialogState(ctx, UID, 1);
    //         receiverGlobal = await urepo.getUserMessagingState(ctx, UID);
    //         expect(receiverState.unread).toBe(6);
    //         expect(receiverGlobal.unread).toBe(0);
    //     });
    // });
    //
    // it('should decrease global unread on dialog mute', async () => {
    //     await inTx(createNamedContext('test')(), async ctx => {
    //         let urepo = container.get<UserStateRepository>('UserStateRepository');
    //         let mrepo = container.get<MessagingRepository>('MessagingRepository');
    //         let repo = container.get<CountersRepository>('CountersRepository');
    //
    //         const muteChat = async (uid: number, cid: number) => {
    //             let settings = await Modules.Messaging.getRoomSettings(ctx, uid, cid);
    //             await repo.onDialogMuteChange(ctx, uid, cid, true);
    //             settings.mute = true;
    //             await settings.flush();
    //         };
    //         let UID = 78;
    //
    //         let mid1 = (await mrepo.createMessage(ctx, 1, 1, { message: '1' })).message.id!;
    //         let mid2 = (await mrepo.createMessage(ctx, 1, 1, { message: '1' })).message.id!;
    //         let mid3 = (await mrepo.createMessage(ctx, 1, 1, { message: '1' })).message.id!;
    //         expect((await repo.onMessageReceived(ctx, UID, mid1)).delta).toBe(1);
    //         expect((await repo.onMessageReceived(ctx, UID, mid2)).delta).toBe(1);
    //         expect((await repo.onMessageReceived(ctx, UID, mid3)).delta).toBe(1);
    //
    //         let receiverState = await urepo.getUserDialogState(ctx, UID, 1);
    //         let receiverGlobal = await urepo.getUserMessagingState(ctx, UID);
    //
    //         expect(receiverState.unread).toBe(3);
    //         expect(receiverGlobal.unread).toBe(3);
    //
    //         await muteChat(UID, 1);
    //
    //         receiverState = await urepo.getUserDialogState(ctx, UID, 1);
    //         receiverGlobal = await urepo.getUserMessagingState(ctx, UID);
    //         expect(receiverState.unread).toBe(3);
    //         expect(receiverGlobal.unread).toBe(0);
    //     });
    // });
    //
    // it('should increase global unread on dialog unmute', async () => {
    //     await inTx(createEmptyContext(), async ctx => {
    //         let urepo = container.get<UserStateRepository>('UserStateRepository');
    //         let mrepo = container.get<MessagingRepository>('MessagingRepository');
    //         let repo = container.get<CountersRepository>('CountersRepository');
    //
    //         const muteChat = async (uid: number, cid: number) => {
    //             let settings = await Modules.Messaging.getRoomSettings(ctx, uid, cid);
    //             await repo.onDialogMuteChange(ctx, uid, cid, true);
    //             settings.mute = true;
    //             await settings.flush();
    //         };
    //         let UID = 79;
    //
    //         const unMuteChat = async (uid: number, cid: number) => {
    //             let settings = await Modules.Messaging.getRoomSettings(ctx, uid, cid);
    //             await repo.onDialogMuteChange(ctx, uid, cid, false);
    //             settings.mute = false;
    //             await settings.flush();
    //         };
    //
    //         await muteChat(UID, 1);
    //
    //         let mid1 = (await mrepo.createMessage(ctx, 1, 1, { message: '1' })).message.id!;
    //         let mid2 = (await mrepo.createMessage(ctx, 1, 1, { message: '1' })).message.id!;
    //         let mid3 = (await mrepo.createMessage(ctx, 1, 1, { message: '1' })).message.id!;
    //         expect((await repo.onMessageReceived(ctx, UID, mid1)).delta).toBe(1);
    //         expect((await repo.onMessageReceived(ctx, UID, mid2)).delta).toBe(1);
    //         expect((await repo.onMessageReceived(ctx, UID, mid3)).delta).toBe(1);
    //
    //         let receiverState = await urepo.getUserDialogState(ctx, UID, 1);
    //         let receiverGlobal = await urepo.getUserMessagingState(ctx, UID);
    //
    //         expect(receiverState.unread).toBe(3);
    //         expect(receiverGlobal.unread).toBe(0);
    //
    //         await unMuteChat(UID, 1);
    //
    //         receiverState = await urepo.getUserDialogState(ctx, UID, 1);
    //         receiverGlobal = await urepo.getUserMessagingState(ctx, UID);
    //         expect(receiverState.unread).toBe(3);
    //         expect(receiverGlobal.unread).toBe(3);
    //     });
    // });
});