import 'reflect-metadata';
import { delay } from '../openland-utils/timer';
import { withLogDisabled } from 'openland-log/withLogDisabled';
import { testEnvironmentStart, testEnvironmentEnd } from 'openland-modules/testEnvironment';
import { Modules } from 'openland-modules/Modules';
import { FDB } from 'openland-module-db/FDB';
import { container } from 'openland-modules/Modules.container';
import { PresenceModule } from './PresenceModule';
import { createEmptyContext } from 'openland-utils/Context';
import { UsersModule } from '../openland-module-users/UsersModule';
import { UserRepository } from '../openland-module-users/repositories/UserRepository';

describe('PresenceModule', () => {
    beforeAll(async () => {
        await testEnvironmentStart('presence');
        container.bind(PresenceModule).toSelf().inSingletonScope();
        container.bind(UsersModule).toSelf().inSingletonScope();
        container.bind('UserRepository').to(UserRepository).inSingletonScope();
    });
    afterAll(() => {
        testEnvironmentEnd();
    });

    it('should setOnline', async () => {
        let ctx = createEmptyContext();
        await withLogDisabled(async () => {
            await Modules.Presence.setOnline(ctx, 9, '1', 5000, 'test', true);
            let p = await FDB.Presence.findById(ctx, 9, '1');
            expect(p).not.toBeNull();
            expect(p!.lastSeenTimeout).toEqual(5000);
            expect(p!.platform).toEqual('test');
            let online = await FDB.Online.findById(ctx, 9);
            expect(online).not.toBeNull();
            expect(online!.uid).toEqual(9);
            expect(online!.lastSeen).toBeGreaterThan(Date.now());
        });
    });

    it('should return lastSeen', async () => {
        let ctx = createEmptyContext();
        await withLogDisabled(async () => {
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
    });

    it('should setOffline', async () => {
        let ctx = createEmptyContext();
        await withLogDisabled(async () => {
            await Modules.Presence.setOnline(ctx, 7, '1', 5000, 'test', true);
            let lastSeen = await Modules.Presence.getLastSeen(ctx, 7);
            expect(lastSeen).toEqual('online');
            await Modules.Presence.setOffline(ctx, 7);
            lastSeen = await Modules.Presence.getLastSeen(ctx, 7);
            expect(lastSeen).toBeLessThanOrEqual(Date.now());
        });
    });

    it('should return active status', async () => {
        let ctx = createEmptyContext();
        await withLogDisabled(async () => {
            await Modules.Presence.setOnline(ctx, 7, '1', 5000, 'test', true);
            let active = await Modules.Presence.isActive(ctx, 7);
            expect(active).toEqual(true);
            await Modules.Presence.setOffline(ctx, 7);
            active = await Modules.Presence.isActive(ctx, 7);
            expect(active).toEqual(false);
            await Modules.Presence.setOnline(ctx, 7, '1', 5000, 'test', false);
            active = await Modules.Presence.isActive(ctx, 7);
            expect(active).toEqual(false);
        });
    });

    it('should return events', async () => {
        let ctx = createEmptyContext();
        await withLogDisabled(async () => {
            let stream = await Modules.Presence.createPresenceStream(0, [1, 2, 3, 4, 5]);
            // tslint:disable-next-line:no-floating-promises
            (async () => {
                await Modules.Presence.setOnline(ctx, 1, '1', 100, 'test', true);
                await Modules.Presence.setOnline(ctx, 2, '1', 100, 'test', true);
                await Modules.Presence.setOnline(ctx, 3, '1', 100, 'test', true);
                await Modules.Presence.setOnline(ctx, 4, '1', 100, 'test', true);
                await Modules.Presence.setOnline(ctx, 5, '1', 100, 'test', true);
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
});