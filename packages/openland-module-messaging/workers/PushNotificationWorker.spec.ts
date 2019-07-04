import { testEnvironmentEnd, testEnvironmentStart } from '../../openland-modules/testEnvironment';
import { loadMessagingTestModule } from '../Messaging.container.test';
import { container } from '../../openland-modules/Modules.container';
import { UsersModule } from '../../openland-module-users/UsersModule';
import { loadUsersModule } from '../../openland-module-users/UsersModule.container';
import { OrganizationModule } from '../../openland-module-organization/OrganizationModule';
import { SuperModule } from '../../openland-module-super/SuperModule';
import { OrganizationRepository } from '../../openland-module-organization/repositories/OrganizationRepository';
import { clearPushResults, pushModuleResults } from 'openland-module-push/PushModule.mock';
import { inTx } from '@openland/foundationdb';
import { Modules } from 'openland-modules/Modules';
import { MessagingModule } from '../MessagingModule';
import { delay } from '../../openland-utils/timer';
import { createNamedContext } from '@openland/context';
import { FDB } from 'openland-module-db/FDB';

describe('PushNotificationWorker', () => {
    beforeAll(async () => {
        await testEnvironmentStart('push-notification-worker');
        loadMessagingTestModule();
        container.bind(UsersModule).toSelf().inSingletonScope();
        loadUsersModule();
        container.bind(OrganizationModule).toSelf().inSingletonScope();
        container.bind(SuperModule).toSelf().inSingletonScope();
        container.bind('OrganizationRepository').to(OrganizationRepository).inSingletonScope();
        container.get(MessagingModule).start();
    });
    afterAll(async () => {
        await testEnvironmentEnd();
    });

    beforeEach(() => {
        clearPushResults();
    });

    const rootCtx = createNamedContext('kek');

    it('should ignore never online', async () => {
        let users = container.get(UsersModule);
        // container.get(MessagingModule).start();
        await inTx(rootCtx, async (ctx) => {
            let USER_ID1 = await users.createTestUser(ctx, 'user' + Math.random(), 'email' + Math.random());
            let USER_ID2 = await users.createTestUser(ctx, 'user' + Math.random(), 'email' + Math.random());

            // await Modules.Presence.setOnline(ctx, USER_ID1, 'kek', 1000, 'web', true);
            // await Modules.Presence.setOnline(ctx, USER_ID2, 'kek 2', 1000, 'web', true);

            let chat = await Modules.Messaging.room.resolvePrivateChat(ctx, USER_ID1, USER_ID2);
            // await Modules.Messaging.markAsSeqRead(ctx, USER_ID1, 1);

            return {
                message: await Modules.Messaging.sendMessage(ctx, chat.id, USER_ID2, { message: 'kek' }),
                sender: USER_ID2,
                reciever: USER_ID1,
                cid: chat.id,
            };
        });

        await delay(8000);

        expect(pushModuleResults.androidPushes).toEqual([]);
        expect(pushModuleResults.applePushes).toEqual([]);
        expect(pushModuleResults.pushedWork).toEqual([]);
        expect(pushModuleResults.counterPushes).toEqual([]);
        expect(pushModuleResults.webPushes).toEqual([]);
        expect(pushModuleResults.safariPushes).toEqual([]);
    });

    it('should skip active', async () => {
        let users = container.get(UsersModule);
        // container.get(MessagingModule).start();
        let testData = await inTx(rootCtx, async (ctx) => {
            let USER_ID1 = await users.createTestUser(ctx, 'user' + Math.random(), 'email' + Math.random());
            let USER_ID2 = await users.createTestUser(ctx, 'user' + Math.random(), 'email' + Math.random());

            await Modules.Presence.setOnline(ctx, USER_ID1, 'kek', 15000, 'web', true);
            await Modules.Presence.setOnline(ctx, USER_ID2, 'kek 2', 15000, 'web', true);

            let chat = await Modules.Messaging.room.resolvePrivateChat(ctx, USER_ID1, USER_ID2);
            // await Modules.Messaging.markAsSeqRead(ctx, USER_ID1, 1);

            return {
                message: await Modules.Messaging.sendMessage(ctx, chat.id, USER_ID2, { message: 'kek' }),
                sender: USER_ID2,
                reciever: USER_ID1,
                cid: chat.id,
            };
        });

        await delay(8000);

        expect(pushModuleResults.androidPushes).toEqual([]);
        expect(pushModuleResults.applePushes).toEqual([]);
        expect(pushModuleResults.pushedWork).toEqual([]);
        expect(pushModuleResults.counterPushes).toEqual(expect.arrayContaining([{ uid: testData.sender }, { uid: testData.reciever }]));
        expect(pushModuleResults.webPushes).toEqual([]);
        expect(pushModuleResults.safariPushes).toEqual([]);
    });

    // it('should skip delay', async () => {
    //     let users = container.get(UsersModule);
    //     // container.get(MessagingModule).start();
    //     let testData = await inTx(rootCtx, async (ctx) => {
    //         let USER_ID1 = await users.createTestUser(ctx, 'user' + Math.random(), 'email' + Math.random());
    //         let USER_ID2 = await users.createTestUser(ctx, 'user' + Math.random(), 'email' + Math.random());
    //
    //         await Modules.Presence.setOnline(ctx, USER_ID1, 'kek', 60000, 'web', true);
    //         await Modules.Presence.setOnline(ctx, USER_ID2, 'kek 2', 60000, 'web', true);
    //
    //         let chat = await Modules.Messaging.room.resolvePrivateChat(ctx, USER_ID1, USER_ID2);
    //         await Modules.Messaging.markAsSeqRead(ctx, USER_ID1, 1);
    //
    //         return {
    //             message: await Modules.Messaging.sendMessage(ctx, chat.id, USER_ID2, { message: 'kek' }),
    //             sender: USER_ID2,
    //             reciever: USER_ID1,
    //             cid: chat.id,
    //         };
    //     });
    //
    //     // await inTx(rootCtx, async ctx => {
    //     //     let online = await FDB.Online.findById(ctx, testData.reciever);
    //     //     online!.lastSeen = Date.now() - 60000;
    //     //     online!.active = false;
    //     //     online!.flush(ctx);
    //     // });
    //
    //     await delay(10000);
    //
    //     expect(pushModuleResults.androidPushes).toEqual([]);
    //     expect(pushModuleResults.applePushes).toEqual([]);
    //     expect(pushModuleResults.counterPushes).toEqual(expect.arrayContaining([{ uid: testData.reciever }]));
    //     expect(pushModuleResults.pushedWork).toEqual([]);
    //     expect(pushModuleResults.webPushes).toEqual([]);
    //     expect(pushModuleResults.safariPushes).toEqual([]);
    // });

    it('should skip with disabled notifications', async () => {
        let users = container.get(UsersModule);
        // container.get(MessagingModule).start();
        let testData = await inTx(rootCtx, async (ctx) => {
            let USER_ID1 = await users.createTestUser(ctx, 'user' + Math.random(), 'email' + Math.random());
            let USER_ID2 = await users.createTestUser(ctx, 'user' + Math.random(), 'email' + Math.random());

            await Modules.Presence.setOnline(ctx, USER_ID1, 'kek', 1000, 'web', true);
            await Modules.Presence.setOnline(ctx, USER_ID2, 'kek 2', 1000, 'web', true);

            let settings = await Modules.Users.getUserSettings(ctx, USER_ID2);
            settings.desktopNotifications = 'none';
            settings.mobileNotifications = 'none';
            let settings2 = await Modules.Users.getUserSettings(ctx, USER_ID1);
            settings2.desktopNotifications = 'none';
            settings2.mobileNotifications = 'none';
            settings.flush(ctx);
            settings2.flush(ctx);

            let chat = await Modules.Messaging.room.resolvePrivateChat(ctx, USER_ID1, USER_ID2);
            await Modules.Messaging.markAsSeqRead(ctx, USER_ID1, 1);

            return {
                message: await Modules.Messaging.sendMessage(ctx, chat.id, USER_ID2, { message: 'kek' }),
                sender: USER_ID2,
                reciever: USER_ID1,
                cid: chat.id,
            };
        });

        await inTx(rootCtx, async ctx => {
            let online = await FDB.Online.findById(ctx, testData.reciever);
            online!.lastSeen = Date.now() - 61000;
            online!.active = false;
            online!.flush(ctx);
        });

        await delay(15000);

        expect(pushModuleResults.androidPushes).toEqual([]);
        expect(pushModuleResults.applePushes).toEqual([]);
        expect(pushModuleResults.counterPushes).toEqual(expect.arrayContaining([{ uid: testData.reciever }]));
        expect(pushModuleResults.pushedWork).toEqual([]);
        expect(pushModuleResults.webPushes).toEqual([]);
        expect(pushModuleResults.safariPushes).toEqual([]);
    });

    it('should ignore never opened apps', async () => {
        let users = container.get(UsersModule);
        // container.get(MessagingModule).start();
        let testData = await inTx(rootCtx, async (ctx) => {
            let USER_ID1 = await users.createTestUser(ctx, 'user' + Math.random(), 'email' + Math.random());
            let USER_ID2 = await users.createTestUser(ctx, 'user' + Math.random(), 'email' + Math.random());

            // await Modules.Presence.setOnline(ctx, USER_ID1, 'kek', 1000, 'web', false);
            // await Modules.Presence.setOnline(ctx, USER_ID2, 'kek 2', 1000, 'web', false);
            //
            // let chat = await Modules.Messaging.room.resolvePrivateChat(ctx, USER_ID1, USER_ID2);
            // // await Modules.Messaging.markAsSeqRead(ctx, USER_ID1, 1);
            //
            return {
               // message: await Modules.Messaging.sendMessage(ctx, chat.id, USER_ID2, { message: 'kek' }),
                sender: USER_ID2,
                reciever: USER_ID1,
               // cid: chat.id,
            };
        });

        await delay(8000);

        expect(pushModuleResults.androidPushes).toEqual([]);
        expect(pushModuleResults.applePushes).toEqual([]);
        expect(pushModuleResults.pushedWork).toEqual([]);
        expect(pushModuleResults.counterPushes).not.toEqual(expect.arrayContaining([{ uid: testData.reciever }, { uid: testData.sender }]));
        expect(pushModuleResults.webPushes).toEqual([]);
        expect(pushModuleResults.safariPushes).toEqual([]);
    });

    it('should create all push', async () => {
        let users = container.get(UsersModule);
        // container.get(MessagingModule).start();
        let testData = await inTx(rootCtx, async (ctx) => {
            let USER_ID1 = await users.createTestUser(ctx, 'user' + Math.random(), 'email' + Math.random());
            let USER_ID2 = await users.createTestUser(ctx, 'user' + Math.random(), 'email' + Math.random());

            await Modules.Presence.setOnline(ctx, USER_ID1, 'kek', 1000, 'web', true);
            await Modules.Presence.setOnline(ctx, USER_ID2, 'kek 2', 1000, 'web', true);

            let chat = await Modules.Messaging.room.resolvePrivateChat(ctx, USER_ID1, USER_ID2);
            await Modules.Messaging.markAsSeqRead(ctx, USER_ID1, 1);

            return {
                message: await Modules.Messaging.sendMessage(ctx, chat.id, USER_ID2, { message: 'kek' }),
                sender: USER_ID2,
                reciever: USER_ID1,
                cid: chat.id,
            };
        });

        await inTx(rootCtx, async ctx => {
            let online = await FDB.Online.findById(ctx, testData.reciever);
            online!.lastSeen = Date.now() - 61000;
            online!.active = false;
            online!.flush(ctx);
        });

        await delay(15000);

        expect(pushModuleResults.androidPushes).toEqual([]);
        expect(pushModuleResults.applePushes).toEqual([]);
        expect(pushModuleResults.pushedWork.length).toEqual(1);
        expect(pushModuleResults.pushedWork[0]).toEqual(expect.objectContaining({
            uid: testData.reciever,
            body: 'kek',
            picture: null,
            counter: 1,
            conversationId: testData.cid,
            mobile: true,
            desktop: true,
            mobileAlert: true,
            mobileIncludeText: true,
            silent: null,
        }));
        expect(pushModuleResults.webPushes).toEqual([]);
        expect(pushModuleResults.safariPushes).toEqual([]);
    });

    it('should create web push only', async () => {
        let users = container.get(UsersModule);
        // container.get(MessagingModule).start();
        let testData = await inTx(rootCtx, async (ctx) => {
            let USER_ID1 = await users.createTestUser(ctx, 'user' + Math.random(), 'email' + Math.random());
            let USER_ID2 = await users.createTestUser(ctx, 'user' + Math.random(), 'email' + Math.random());

            await Modules.Presence.setOnline(ctx, USER_ID1, 'kek', 1000, 'web', true);
            await Modules.Presence.setOnline(ctx, USER_ID2, 'kek 2', 1000, 'web', true);

            let chat = await Modules.Messaging.room.resolvePrivateChat(ctx, USER_ID1, USER_ID2);
            await Modules.Messaging.markAsSeqRead(ctx, USER_ID1, 1);

            let settings = await Modules.Users.getUserSettings(ctx, USER_ID2);
            settings.mobileNotifications = 'none';
            let settings2 = await Modules.Users.getUserSettings(ctx, USER_ID1);
            settings2.mobileNotifications = 'none';
            settings.flush(ctx);
            settings2.flush(ctx);

            return {
                message: await Modules.Messaging.sendMessage(ctx, chat.id, USER_ID2, { message: 'kek' }),
                sender: USER_ID2,
                reciever: USER_ID1,
                cid: chat.id,
            };
        });

        await inTx(rootCtx, async ctx => {
            let online = await FDB.Online.findById(ctx, testData.reciever);
            online!.lastSeen = Date.now() - 61000;
            online!.active = false;
            online!.flush(ctx);
        });

        await delay(15000);

        expect(pushModuleResults.androidPushes).toEqual([]);
        expect(pushModuleResults.applePushes).toEqual([]);
        expect(pushModuleResults.pushedWork.length).toEqual(1);
        expect(pushModuleResults.pushedWork[0]).toEqual(expect.objectContaining({
            uid: testData.reciever,
            body: 'kek',
            picture: null,
            counter: 1,
            conversationId: testData.cid,
            mobile: false,
            desktop: true,
            mobileAlert: true,
            mobileIncludeText: true,
            silent: null,
        }));
        expect(pushModuleResults.webPushes).toEqual([]);
        expect(pushModuleResults.safariPushes).toEqual([]);
    });

    it('should create mobile push only', async () => {
        let users = container.get(UsersModule);
        // container.get(MessagingModule).start();
        let testData = await inTx(rootCtx, async (ctx) => {
            let USER_ID1 = await users.createTestUser(ctx, 'user' + Math.random(), 'email' + Math.random());
            let USER_ID2 = await users.createTestUser(ctx, 'user' + Math.random(), 'email' + Math.random());

            await Modules.Presence.setOnline(ctx, USER_ID1, 'kek', 1000, 'web', true);
            await Modules.Presence.setOnline(ctx, USER_ID2, 'kek 2', 1000, 'web', true);

            let chat = await Modules.Messaging.room.resolvePrivateChat(ctx, USER_ID1, USER_ID2);
            await Modules.Messaging.markAsSeqRead(ctx, USER_ID1, 1);

            let settings = await Modules.Users.getUserSettings(ctx, USER_ID2);
            settings.desktopNotifications = 'none';
            let settings2 = await Modules.Users.getUserSettings(ctx, USER_ID1);
            settings2.desktopNotifications = 'none';
            settings.flush(ctx);
            settings2.flush(ctx);

            return {
                message: await Modules.Messaging.sendMessage(ctx, chat.id, USER_ID2, { message: 'kek' }),
                sender: USER_ID2,
                reciever: USER_ID1,
                cid: chat.id,
            };
        });

        await inTx(rootCtx, async ctx => {
            let online = await FDB.Online.findById(ctx, testData.reciever);
            online!.lastSeen = Date.now() - 61000;
            online!.active = false;
            online!.flush(ctx);
        });

        await delay(15000);

        expect(pushModuleResults.androidPushes).toEqual([]);
        expect(pushModuleResults.applePushes).toEqual([]);
        expect(pushModuleResults.pushedWork.length).toEqual(1);
        expect(pushModuleResults.pushedWork[0]).toEqual(expect.objectContaining({
            uid: testData.reciever,
            body: 'kek',
            picture: null,
            counter: 1,
            conversationId: testData.cid,
            mobile: true,
            desktop: false,
            mobileAlert: true,
            mobileIncludeText: true,
            silent: null,
        }));
        expect(pushModuleResults.webPushes).toEqual([]);
        expect(pushModuleResults.safariPushes).toEqual([]);
    });
});