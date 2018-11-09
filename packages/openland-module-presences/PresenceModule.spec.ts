import 'reflect-metadata';
import { delay } from '../openland-utils/timer';
import { withLogDisabled } from 'openland-log/withLogDisabled';
import { testEnvironmentStart, testEnvironmentEnd } from 'openland-modules/testEnvironment';
import { Modules } from 'openland-modules/Modules';
import { FDB } from 'openland-module-db/FDB';
import { container } from 'openland-modules/Modules.container';
import { PresenceModule } from './PresenceModule';

describe('PresenceModule', () => {
    beforeAll(async () => {
        await testEnvironmentStart('presence');
        container.bind(PresenceModule).toSelf().inSingletonScope();
    });
    afterAll(() => {
        testEnvironmentEnd();
    });

    it('should setOnline', async () => {
        await withLogDisabled(async () => {
            await Modules.Presence.setOnline(9, '1', 5000, 'test');
            let p = await FDB.Presence.findById(9, '1');
            expect(p).not.toBeNull();
            expect(p!.lastSeenTimeout).toEqual(5000);
            expect(p!.platform).toEqual('test');
            let online = await FDB.Online.findById(9);
            expect(online).not.toBeNull();
            expect(online!.uid).toEqual(9);
            expect(online!.lastSeen).toBeGreaterThan(Date.now());
        });
    });

    it('should return lastSeen', async () => {
        await withLogDisabled(async () => {
            // online
            await Modules.Presence.setOnline(2, '1', 1000, 'test');
            let lastSeen = await Modules.Presence.getLastSeen(2);
            expect(lastSeen).toEqual('online');

            // offline
            await delay(1000);
            lastSeen = await Modules.Presence.getLastSeen(2);
            expect(lastSeen).toBeLessThan(Date.now());

            // never_online
            expect(await Modules.Presence.getLastSeen(7)).toEqual('never_online');
        });
    });

    it('should return events', async () => {
        await withLogDisabled(async () => {
            let stream = await Modules.Presence.createPresenceStream(0, [1, 2, 3, 4, 5]);
            // tslint:disable-next-line:no-floating-promises
            (async () => {
                await Modules.Presence.setOnline(1, '1', 100, 'test');
                await Modules.Presence.setOnline(2, '1', 100, 'test');
                await Modules.Presence.setOnline(3, '1', 100, 'test');
                await Modules.Presence.setOnline(4, '1', 100, 'test');
                await Modules.Presence.setOnline(5, '1', 100, 'test');
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