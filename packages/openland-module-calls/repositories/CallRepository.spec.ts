import { testEnvironmentStart, testEnvironmentEnd } from 'openland-modules/testEnvironment';
import { container } from 'openland-modules/Modules.container';
import { CallRepository } from './CallRepository';
import { createEmptyContext } from 'openland-utils/Context';
import { FDB } from 'openland-module-db/FDB';

describe('CallRepository', () => {
    beforeAll(async () => {
        await testEnvironmentStart('calls-repo');
        container.bind(CallRepository).toSelf().inSingletonScope();
    });
    afterAll(() => {
        testEnvironmentEnd();
    });
    it('should create conference', async () => {
        let repo = container.get(CallRepository);
        let conf1 = await repo.getOrCreateConference(createEmptyContext(), 1);
        let conf2 = await repo.getOrCreateConference(createEmptyContext(), 1);
        expect(conf1.versionCode).toBe(1);
        expect(conf2.versionCode).toBe(1);
    });

    it('should add peers', async () => {
        let CID = 2;
        let repo = container.get(CallRepository);
        let peer = await repo.addNewPeer(createEmptyContext(), CID, 3, 'tid1', 5000);
        let peers = await FDB.ConferencePeer.allFromConference(createEmptyContext(), CID);
        expect(peers.length).toBe(1);
        expect(peer.uid).toBe(3);
        expect(peer.cid).toBe(CID);
        expect(peer.tid).toBe('tid1');
        expect(peers[0].id).toBe(peer.id);
        expect(peers[0].uid).toBe(peer.uid);
        expect(peers[0].cid).toBe(peer.cid);
        expect(peers[0].tid).toBe(peer.tid);
    });

    it('should automatically connect peers', async () => {
        let CID = 3;
        let repo = container.get(CallRepository);
        let peer1 = await repo.addNewPeer(createEmptyContext(), CID, 3, 'tid1', 5000);
        let peer2 = await repo.addNewPeer(createEmptyContext(), CID, 4, 'tid2', 5000);
        let peers = await FDB.ConferencePeer.allFromConference(createEmptyContext(), CID);
        expect(peer1.id).toBeLessThan(peer2.id);
        expect(peer1.uid).toBe(3);
        expect(peer2.uid).toBe(4);
        expect(peers.length).toBe(2);
        let connection = await FDB.ConferenceConnection.findById(createEmptyContext(), peer1.id, peer2.id);
        expect(connection).not.toBeNull();
        expect(connection).not.toBeUndefined();
    });
});