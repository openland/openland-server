import { Database } from '@openland/foundationdb';
import { EntityLayer } from './../../foundation-orm/EntityLayer';
// tslint:disable:no-floating-promises
import { FConnection } from 'foundation-orm/FConnection';
import { AllEntities, AllEntitiesDirect } from 'openland-module-db/schema';
import { PushRepository } from './PushRepository';
import { NoOpBus } from 'foundation-orm/tests/NoOpBus';
import { createNamedContext } from '@openland/context';

describe('PushRepository', () => {
    // Database Init
    let entities: AllEntities;

    beforeAll(async () => {
        let db = await Database.openTest();
        let connection = new FConnection(db);
        let layer = new EntityLayer(connection, NoOpBus);
        entities = new AllEntitiesDirect(layer);
        await layer.ready(createNamedContext('test'));
    });

    it('should register web push', async () => {
        let ctx = createNamedContext('test');
        let repo = new PushRepository(entities);
        await repo.registerPushWeb(ctx, 1, 'token1', 'endpoint!');
        let res = await repo.getUserWebPushTokens(ctx, 1);
        expect(res.length).toBe(1);
        expect(res[0].uid).toBe(1);
        expect(res[0].tid).toBe('token1');
        expect(res[0].endpoint).toBe('endpoint!');
    });

    it('should move web push registration to new user/token', async () => {
        let ctx = createNamedContext('test');
        let repo = new PushRepository(entities);
        await repo.registerPushWeb(ctx, 2, 'token2', 'endpoint2');
        await repo.registerPushWeb(ctx, 3, 'token3', 'endpoint2');
        let res2 = await repo.getUserWebPushTokens(ctx, 2);
        let res3 = await repo.getUserWebPushTokens(ctx, 3);
        expect(res2.length).toBe(0);
        expect(res3.length).toBe(1);
        expect(res3[0].uid).toBe(3);
        expect(res3[0].tid).toBe('token3');
        expect(res3[0].endpoint).toBe('endpoint2');
    });

    it('should register android push', async () => {
        let ctx = createNamedContext('test');
        let repo = new PushRepository(entities);
        await repo.registerPushAndroid(ctx, 1, 'token1', 'endpoint!', 'package', false);
        let res = await repo.getUserAndroidPushTokens(ctx, 1);
        expect(res.length).toBe(1);
        expect(res[0].uid).toBe(1);
        expect(res[0].tid).toBe('token1');
        expect(res[0].token).toBe('endpoint!');
        expect(res[0].packageId).toBe('package');
        expect(res[0].sandbox).toBe(false);
    });

    it('should move android push registration to new user/token', async () => {
        let ctx = createNamedContext('test');
        let repo = new PushRepository(entities);
        await repo.registerPushAndroid(ctx, 2, 'token1', 'endpoint!', 'package', false);
        await repo.registerPushAndroid(ctx, 3, 'token2', 'endpoint!', 'package', false);
        let res2 = await repo.getUserAndroidPushTokens(ctx, 2);
        let res3 = await repo.getUserAndroidPushTokens(ctx, 3);
        expect(res2.length).toBe(0);
        expect(res3.length).toBe(1);
        expect(res3[0].uid).toBe(3);
        expect(res3[0].tid).toBe('token2');
        expect(res3[0].token).toBe('endpoint!');
    });

    it('should register apple push', async () => {
        let ctx = createNamedContext('test');
        let repo = new PushRepository(entities);
        await repo.registerPushApple(ctx, 1, 'token1', 'endpoint!', 'package', false);
        let res = await repo.getUserApplePushTokens(ctx, 1);
        expect(res.length).toBe(1);
        expect(res[0].uid).toBe(1);
        expect(res[0].tid).toBe('token1');
        expect(res[0].token).toBe('endpoint!');
        expect(res[0].bundleId).toBe('package');
        expect(res[0].sandbox).toBe(false);
    });

    it('should move apple push registration to new user/token', async () => {
        let ctx = createNamedContext('test');
        let repo = new PushRepository(entities);
        await repo.registerPushApple(ctx, 2, 'token1', 'endpoint!', 'package', false);
        await repo.registerPushApple(ctx, 3, 'token2', 'endpoint!', 'package', false);
        let res2 = await repo.getUserApplePushTokens(ctx, 2);
        let res3 = await repo.getUserApplePushTokens(ctx, 3);
        expect(res2.length).toBe(0);
        expect(res3.length).toBe(1);
        expect(res3[0].uid).toBe(3);
        expect(res3[0].tid).toBe('token2');
        expect(res3[0].token).toBe('endpoint!');
    });
});