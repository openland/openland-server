import * as fdb from 'foundationdb';
import { FConnection } from '../foundation-orm/FConnection';
import { AllEntities } from '../openland-module-db/schema';
import { PresenceModule } from './PresenceModule';
import { delay } from '../openland-server/utils/timer';

describe('PresenceModule', () => {
    // Database Init
    let db: fdb.Database<fdb.TupleItem[], any>;
    let fdb: AllEntities;
    let Presence: PresenceModule;

    beforeAll(async () => {
        db = FConnection.create()
            .at(['_tests_presence']);
        await db.clearRange([]);
        fdb = new AllEntities(new FConnection(db));

        Presence = new PresenceModule();
        Presence.start(fdb);
    });

    it('should setOnline', async () => {
        await Presence.setOnline(9, '1', 5000, 'test');
        let p = await fdb.Presence.findById(9, '1');
        expect(p).not.toBeNull();
        expect(p!.lastSeenTimeout).toEqual(5000);
        expect(p!.platform).toEqual('test');
        let online = await fdb.Online.findById(9);
        expect(online).not.toBeNull();
        expect(online!.uid).toEqual(9);
        expect(online!.lastSeen).toBeGreaterThan(Date.now());
    });

    it('should return lastSeen', async () => {
        // online
        await Presence.setOnline(2, '1', 1000, 'test');
        let lastSeen = await Presence.getLastSeen(2);
        expect(lastSeen).toEqual('online');

        // offline
        await delay(1000);
        lastSeen = await Presence.getLastSeen(2);
        expect(lastSeen).toBeLessThan(Date.now());

        // never_online
        expect(await Presence.getLastSeen(7)).toEqual('never_online');
    });

    it('should return events', async () => {
        let stream = await Presence.createPresenceStream(0, [1, 2, 3, 4, 5]);
        (async () => {
            await Presence.setOnline(1, '1', 100, 'test');
            await Presence.setOnline(2, '1', 100, 'test');
            await Presence.setOnline(3, '1', 100, 'test');
            await Presence.setOnline(4, '1', 100, 'test');
            await Presence.setOnline(5, '1', 100, 'test');
        })();

        let onlineState = [false, false, false, false, false, false];
        let evs: any[] = [];

        for await (let event of stream) {
            console.log('event', event);
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