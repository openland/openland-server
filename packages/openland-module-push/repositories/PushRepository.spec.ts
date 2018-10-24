// tslint:disable:no-floating-promises
import * as fdb from 'foundationdb';
import { FConnection } from 'foundation-orm/FConnection';
import { AllEntities } from 'openland-module-db/schema';
import { PushRepository } from './PushRepository';
import { withLogDisabled } from 'openland-log/withLogDisabled';

describe('PushRepository', () => {
    // Database Init
    let db: fdb.Database<fdb.TupleItem[], any>;
    let entities: AllEntities;
    beforeAll(async () => {
        db = FConnection.create()
            .at(['_tests_push_repo']);
        await db.clearRange([]);
        entities = new AllEntities(new FConnection(db));
    });

    it('should register web push', async () => {
        await withLogDisabled(async () => {
            let repo = new PushRepository(entities);
            await repo.registerPushWeb(1, 'token1', 'endpoint!');
            let res = await repo.getUserWebPushTokens(1);
            expect(res.length).toBe(1);
            expect(res[0].uid).toBe(1);
            expect(res[0].tid).toBe('token1');
            expect(res[0].endpoint).toBe('endpoint!');
        });
    });

    it('should move web push registration to new user/token', async () => {
        await withLogDisabled(async () => {
            let repo = new PushRepository(entities);
            await repo.registerPushWeb(2, 'token2', 'endpoint2');
            await repo.registerPushWeb(3, 'token3', 'endpoint2');
            let res2 = await repo.getUserWebPushTokens(2);
            let res3 = await repo.getUserWebPushTokens(3);
            expect(res2.length).toBe(0);
            expect(res3.length).toBe(1);
            expect(res3[0].uid).toBe(3);
            expect(res3[0].tid).toBe('token3');
            expect(res3[0].endpoint).toBe('endpoint2');
        });
    });

    it('should register android push', async () => {
        await withLogDisabled(async () => {
            let repo = new PushRepository(entities);
            await repo.registerPushAndroid(1, 'token1', 'endpoint!', 'package', false);
            let res = await repo.getUserAndroidPushTokens(1);
            expect(res.length).toBe(1);
            expect(res[0].uid).toBe(1);
            expect(res[0].tid).toBe('token1');
            expect(res[0].token).toBe('endpoint!');
            expect(res[0].packageId).toBe('package');
            expect(res[0].sandbox).toBe(false);
        });
    });

    it('should move android push registration to new user/token', async () => {
        await withLogDisabled(async () => {
            let repo = new PushRepository(entities);
            await repo.registerPushAndroid(2, 'token1', 'endpoint!', 'package', false);
            await repo.registerPushAndroid(3, 'token2', 'endpoint!', 'package', false);
            let res2 = await repo.getUserAndroidPushTokens(2);
            let res3 = await repo.getUserAndroidPushTokens(3);
            expect(res2.length).toBe(0);
            expect(res3.length).toBe(1);
            expect(res3[0].uid).toBe(3);
            expect(res3[0].tid).toBe('token2');
            expect(res3[0].token).toBe('endpoint!');
        });
    });

    it('should register apple push', async () => {
        await withLogDisabled(async () => {
            let repo = new PushRepository(entities);
            await repo.registerPushApple(1, 'token1', 'endpoint!', 'package', false);
            let res = await repo.getUserApplePushTokens(1);
            expect(res.length).toBe(1);
            expect(res[0].uid).toBe(1);
            expect(res[0].tid).toBe('token1');
            expect(res[0].token).toBe('endpoint!');
            expect(res[0].bundleId).toBe('package');
            expect(res[0].sandbox).toBe(false);
        });
    });

    it('should move apple push registration to new user/token', async () => {
        await withLogDisabled(async () => {
            let repo = new PushRepository(entities);
            await repo.registerPushApple(2, 'token1', 'endpoint!', 'package', false);
            await repo.registerPushApple(3, 'token2', 'endpoint!', 'package', false);
            let res2 = await repo.getUserApplePushTokens(2);
            let res3 = await repo.getUserApplePushTokens(3);
            expect(res2.length).toBe(0);
            expect(res3.length).toBe(1);
            expect(res3[0].uid).toBe(3);
            expect(res3[0].tid).toBe('token2');
            expect(res3[0].token).toBe('endpoint!');
        });
    });
});