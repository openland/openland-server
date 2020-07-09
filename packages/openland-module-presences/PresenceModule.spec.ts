import 'reflect-metadata';
import { delay } from '../openland-utils/timer';
import { testEnvironmentStart, testEnvironmentEnd } from 'openland-modules/testEnvironment';
import { Modules } from 'openland-modules/Modules';
import { Store } from 'openland-module-db/FDB';
import { container } from 'openland-modules/Modules.container';
import { UsersModule } from '../openland-module-users/UsersModule';
import { SuperModule } from '../openland-module-super/SuperModule';
import { createNamedContext } from '@openland/context';
import { loadUsersModule } from '../openland-module-users/UsersModule.container';
import { loadPresenceModule } from './PresenceModule.container';

describe('PresenceModule', () => {
    beforeAll(async () => {
        await testEnvironmentStart('presence');
        loadPresenceModule();
        container.bind(UsersModule).toSelf().inSingletonScope();
        loadUsersModule();
        container.bind(SuperModule).toSelf().inSingletonScope();
    });
    afterAll( async () => {
      await  testEnvironmentEnd();
    });

    it('should setOnline', async () => {
        let ctx = createNamedContext('test');
        await Modules.Presence.setOnline(ctx, 9, '1', 5000, 'test', true);
        let p = await Store.Presence.findById(ctx, 9, '1');
        expect(p).not.toBeNull();
        expect(p!.lastSeenTimeout).toEqual(5000);
        expect(p!.platform).toEqual('test');
        let online = await Store.Online.findById(ctx, 9);
        expect(online).not.toBeNull();
        expect(online!.uid).toEqual(9);
        expect(online!.lastSeen).toBeGreaterThan(Date.now());
    });

    it('should return lastSeen', async () => {
        let ctx = createNamedContext('test');
        // online
        await Modules.Presence.setOnline(ctx, 2, '1', 1000, 'test', true);
        let lastSeen = await Modules.Presence.getLastSeen(ctx, 2);
        expect(lastSeen).toEqual('online');

        // offline
        await delay(1000);
        lastSeen = await Modules.Presence.getLastSeen(ctx, 2);
        expect(lastSeen).toBeLessThan(Date.now());

        // never_online
        expect(await Modules.Presence.getLastSeen(ctx, 7)).toEqual('never_online');
    });

    it('should setOffline', async () => {
        let ctx = createNamedContext('test');
        await Modules.Presence.setOnline(ctx, 7, '1', 5000, 'test', true);
        let lastSeen = await Modules.Presence.getLastSeen(ctx, 7);
        expect(lastSeen).toEqual('online');
        await Modules.Presence.setOffline(ctx, 7);
        lastSeen = await Modules.Presence.getLastSeen(ctx, 7);
        expect(lastSeen).toBeLessThanOrEqual(Date.now());
    });

    it('should return active status', async () => {
        let ctx = createNamedContext('test');
        await Modules.Presence.setOnline(ctx, 8, '1', 5000, 'test', true);
        let active = await Modules.Presence.isActive(ctx, 8);
        expect(active).toEqual(true);
        await Modules.Presence.setOffline(ctx, 8);
        active = await Modules.Presence.isActive(ctx, 8);
        expect(active).toEqual(false);
        await Modules.Presence.setOnline(ctx, 8, '1', 5000, 'test', false);
        active = await Modules.Presence.isActive(ctx, 8);
        expect(active).toEqual(false);
    });

    it('should return events', async () => {
        let ctx = createNamedContext('test');
        let stream = await Modules.Presence.createPresenceStream(0, [11, 12, 13, 14, 15]);
        // tslint:disable-next-line:no-floating-promises
        (async () => {
            await Modules.Presence.setOnline(ctx, 11, '1', 100, 'test', true);
            await Modules.Presence.setOnline(ctx, 12, '1', 100, 'test', true);
            await Modules.Presence.setOnline(ctx, 13, '1', 100, 'test', true);
            await Modules.Presence.setOnline(ctx, 14, '1', 100, 'test', true);
            await Modules.Presence.setOnline(ctx, 15, '1', 100, 'test', true);
        })();

        let onlineState = [false, false, false, false, false, false];
        let evs: any[] = [];

        for await (let event of stream) {
            if (!onlineState[event.userId]) {
                expect(event.online).toEqual(true);
                expect(event.timeout).toBeLessThanOrEqual(100);
                onlineState[event.userId] = true;
            } else {
                expect(event.online).toEqual(false);
                expect(event.timeout).toEqual(0);
            }

            evs.push(event);

            if (evs.length === 10) {
                return;
            }
        }
    });
});