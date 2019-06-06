import { testEnvironmentStart, testEnvironmentEnd } from 'openland-modules/testEnvironment';
import { loadMessagingTestModule } from 'openland-module-messaging/Messaging.container.test';
import { container } from 'openland-modules/Modules.container';
import { NeedNotificationDeliveryRepository } from './NeedNotificationDeliveryRepository';
import { inTx } from 'foundation-orm/inTx';
import { EmptyContext } from '@openland/context';

describe('NeedNotificationDeliveryRepository', () => {
    beforeAll(async () => {
        await testEnvironmentStart('need-notification-repo');
        loadMessagingTestModule();
    });
    afterAll(() => {
        testEnvironmentEnd();
    });
    it('should mark as needed', async () => {
        let repo = container.get<NeedNotificationDeliveryRepository>('NeedNotificationDeliveryRepository');

        await inTx(EmptyContext, async (ctx) => {
            repo.setNeedNotificationDelivery(ctx, 1);
        });

        let ex = await repo.findAllUsersWithNotifications(EmptyContext, 'email');
        expect(ex.length).toBe(1);
        expect(ex[0]).toBe(1);

        ex = await repo.findAllUsersWithNotifications(EmptyContext, 'push');
        expect(ex.length).toBe(1);
        expect(ex[0]).toBe(1);

        await inTx(EmptyContext, async (ctx) => {
            repo.resetNeedNotificationDelivery(ctx, 'push', 1);
        });

        ex = await repo.findAllUsersWithNotifications(EmptyContext, 'email');
        expect(ex.length).toBe(1);
        expect(ex[0]).toBe(1);

        ex = await repo.findAllUsersWithNotifications(EmptyContext, 'push');
        expect(ex.length).toBe(0);
    });
});