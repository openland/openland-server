import { inTx } from '@openland/foundationdb';
import { testEnvironmentStart, testEnvironmentEnd } from 'openland-modules/testEnvironment';
import { loadMessagingTestModule } from 'openland-module-messaging/Messaging.container.test';
import { container } from 'openland-modules/Modules.container';
import { NeedNotificationDeliveryRepository } from './NeedNotificationDeliveryRepository';
import { createNamedContext } from '@openland/context';

describe('NeedNotificationDeliveryRepository', () => {
    beforeAll(async () => {
        await testEnvironmentStart('need-notification-repo');
        loadMessagingTestModule();
    });
    afterAll( async () => {
      await  testEnvironmentEnd();
    });
    it('should mark as needed', async () => {
        let repo = container.get<NeedNotificationDeliveryRepository>('NeedNotificationDeliveryRepository');

        await inTx(createNamedContext('test'), async (ctx) => {
            repo.setNeedNotificationDelivery(ctx, 1);
        });

        let ex = await repo.findAllUsersWithNotifications(createNamedContext('test'), 'email');
        expect(ex.length).toBe(1);
        expect(ex[0]).toBe(1);

        ex = await repo.findAllUsersWithNotifications(createNamedContext('test'), 'push');
        expect(ex.length).toBe(1);
        expect(ex[0]).toBe(1);

        await inTx(createNamedContext('test'), async (ctx) => {
            repo.resetNeedNotificationDelivery(ctx, 'push', 1);
        });

        ex = await repo.findAllUsersWithNotifications(createNamedContext('test'), 'email');
        expect(ex.length).toBe(1);
        expect(ex[0]).toBe(1);

        ex = await repo.findAllUsersWithNotifications(createNamedContext('test'), 'push');
        expect(ex.length).toBe(0);
    });
});