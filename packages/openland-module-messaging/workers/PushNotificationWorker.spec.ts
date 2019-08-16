import { testEnvironmentEnd, testEnvironmentStart } from '../../openland-modules/testEnvironment';
import { loadMessagingTestModule } from '../Messaging.container.test';
import { container } from '../../openland-modules/Modules.container';
import { UsersModule } from '../../openland-module-users/UsersModule';
import { loadUsersModule } from '../../openland-module-users/UsersModule.container';
import { OrganizationModule } from '../../openland-module-organization/OrganizationModule';
import { SuperModule } from '../../openland-module-super/SuperModule';
import { OrganizationRepository } from '../../openland-module-organization/repositories/OrganizationRepository';
import { clearPushResults } from 'openland-module-push/PushModule.mock';
// import { createNamedContext } from '@openland/context';
// import { shouldIgnoreUser } from './PushNotificationWorker';

describe('PushNotificationWorker', () => {
    beforeAll(async () => {
        await testEnvironmentStart('push-notification-worker');
        loadMessagingTestModule();
        container.bind(UsersModule).toSelf().inSingletonScope();
        loadUsersModule();
        container.bind(OrganizationModule).toSelf().inSingletonScope();
        container.bind(SuperModule).toSelf().inSingletonScope();
        container.bind('OrganizationRepository').to(OrganizationRepository).inSingletonScope();
    });
    afterAll(async () => {
        await testEnvironmentEnd();
    });

    beforeEach(() => {
        clearPushResults();
    });

    // const rootCtx = createNamedContext('kek');

    // const getUser = (uid: number) => ({
    //     uid: uid,
    //     lastSeen: 'never_online',
    //     lastPushSeq: 0,
    //     userStateSeq: 0,
    //     desktopNotifications: 'all',
    //     notificationsReadSeq: 0,
    //     isActive: false,
    //     mobileNotifications: 'all',
    //     notificationsDelay: 'none'
    // });

    // it('should ignore never online', async () => {
    //     const result = shouldIgnoreUser(
    //         rootCtx,
    //         {
    //             lastSeen: 'never_online',
    //             lastPushSeq: 0,
    //             userStateSeq: 0,
    //             desktopNotifications: 'all',
    //             notificationsReadSeq: 0,
    //             isActive: false,
    //             mobileNotifications: 'all',
    //             notificationsDelay: 'none'
    //         }
    //     );
    //
    //     expect(result).toEqual(true);
    // });
    //
    // it('should skip active', async () => {
    //     const result = shouldIgnoreUser(
    //         rootCtx,
    //         {
    //             lastSeen: 'online',
    //             lastPushSeq: 0,
    //             userStateSeq: 0,
    //             desktopNotifications: 'all',
    //             notificationsReadSeq: 0,
    //             isActive: true,
    //             mobileNotifications: 'all',
    //             notificationsDelay: 'none'
    //         }
    //     );
    //
    //     expect(result).toEqual(true);
    // });
    //
    // it('should skip delay', async () => {
    //     const result = shouldIgnoreUser(
    //         rootCtx,
    //         {
    //             lastSeen: Date.now() - 30000,
    //             lastPushSeq: 0,
    //             userStateSeq: 0,
    //             desktopNotifications: 'all',
    //             notificationsReadSeq: 0,
    //             isActive: false,
    //             mobileNotifications: 'all',
    //             notificationsDelay: '1min'
    //         }
    //     );
    //
    //     expect(result).toEqual(true);
    // });
    //
    // it('should skip with disabled notifications', async () => {
    //     const result = shouldIgnoreUser(
    //         rootCtx,
    //         {
    //             lastSeen: Date.now() - 30000,
    //             lastPushSeq: 2,
    //             userStateSeq: 4,
    //             desktopNotifications: 'none',
    //             notificationsReadSeq: 2,
    //             isActive: false,
    //             mobileNotifications: 'none',
    //             notificationsDelay: 'none'
    //         }
    //     );
    //
    //     expect(result).toEqual(true);
    // });
    //
    // it('should ignore never opened apps', async () => {
    //     const result = shouldIgnoreUser(
    //         rootCtx,
    //         {
    //             lastSeen: Date.now() - 30000,
    //             lastPushSeq: 2,
    //             userStateSeq: 4,
    //             desktopNotifications: 'all',
    //             notificationsReadSeq: null,
    //             isActive: false,
    //             mobileNotifications: 'all',
    //             notificationsDelay: 'none'
    //         }
    //     );
    //
    //     expect(result).toEqual(true);
    // });
    //
    // it('should create all push', async () => {
    //     const result1 = shouldIgnoreUser(
    //         rootCtx,
    //         {
    //             lastSeen: Date.now() - 60000,
    //             lastPushSeq: 2,
    //             userStateSeq: 4,
    //             desktopNotifications: 'all',
    //             notificationsReadSeq: 1,
    //             isActive: false,
    //             mobileNotifications: 'all',
    //             notificationsDelay: 'none'
    //         }
    //     );
    //
    //     expect(result1).toEqual(false);
    // });
});