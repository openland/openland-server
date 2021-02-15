import { testEnvironmentStart, testEnvironmentEnd } from 'openland-modules/testEnvironment';
import { container } from 'openland-modules/Modules.container';
import { CallRepository, DEFAULT_CAPABILITIES } from './CallRepository';
import { Store } from 'openland-module-db/FDB';
import { createNamedContext } from '@openland/context';
import { DeliveryMediator } from '../../openland-module-messaging/mediators/DeliveryMediator';
import { inReadOnlyTx } from '@openland/foundationdb';
// jest.mock('../../openland-module-messaging/mediators/DeliveryMediator');

const rootCtx = createNamedContext('test');

describe('CallRepository', () => {
    beforeAll(async () => {
        await testEnvironmentStart('calls-repo');
        // console.warn(new DeliveryMediator());
        let deliveryMediator = new DeliveryMediator();
        deliveryMediator.onCallStateChanged = jest.fn();
        container.bind('DeliveryMediator').toConstantValue(deliveryMediator);
        container.bind('CallRepository').to(CallRepository).inSingletonScope();
    });
    afterAll(async () => {
        await testEnvironmentEnd();
    });
    it('should create conference', async () => {
        let repo = container.get<CallRepository>('CallRepository');
        let conf1 = await repo.getOrCreateConference(rootCtx, 1);
        let conf2 = await repo.getOrCreateConference(rootCtx, 1);
        expect(conf1.metadata.versionCode).toBe(0);
        expect(conf2.metadata.versionCode).toBe(0);
    });

    it('should add peers', async () => {
        let CID = 2;
        let repo = container.get<CallRepository>('CallRepository');
        let peer = await repo.addPeer(rootCtx, CID, 3, 'tid1', 5000, 'conference', DEFAULT_CAPABILITIES, 'unknown');
        let peers = await inReadOnlyTx(rootCtx, async (ctx) => await Store.ConferencePeer.conference.findAll(ctx, CID));
        expect(peers.length).toBe(1);
        expect(peer.uid).toBe(3);
        expect(peer.cid).toBe(CID);
        expect(peer.tid).toBe('tid1');
        expect(peers[0].id).toBe(peer.id);
        expect(peers[0].uid).toBe(peer.uid);
        expect(peers[0].cid).toBe(peer.cid);
        expect(peers[0].tid).toBe(peer.tid);
        // let connections = await Store.ConferenceConnection.conference.findAll(ctx, CID);
        // expect(connections.length).toBe(0);
    });

    it('should automatically connect peers', async () => {
        let CID = 3;
        let repo = container.get<CallRepository>('CallRepository');
        let peer1 = await repo.addPeer(rootCtx, CID, 3, 'tid1', 5000, 'conference', DEFAULT_CAPABILITIES, 'unknown');
        let peer2 = await repo.addPeer(rootCtx, CID, 4, 'tid2', 5000, 'conference', DEFAULT_CAPABILITIES, 'unknown');
        let peers = await inReadOnlyTx(rootCtx, async (ctx) => await Store.ConferencePeer.conference.findAll(ctx, CID));
        expect(peer1.id).toBeLessThan(peer2.id);
        expect(peer1.uid).toBe(3);
        expect(peer2.uid).toBe(4);
        expect(peers.length).toBe(2);
        // let connections = await Store.ConferenceConnection.conference.findAll(ctx, CID);
        // expect(connections.length).toBe(1);
        // expect(connections[0].cid).toBe(CID);
        // expect(connections[0].state).toBe('wait-offer');
    });

    it('should remove peers and related connections', async () => {
        let CID = 4;
        let repo = container.get<CallRepository>('CallRepository');
        let peer1 = await repo.addPeer(rootCtx, CID, 3, 'tid1', 5000, 'conference', DEFAULT_CAPABILITIES, 'unknown');
        let peer2 = await repo.addPeer(rootCtx, CID, 4, 'tid2', 5000, 'conference', DEFAULT_CAPABILITIES, 'unknown');
        await repo.removePeer(rootCtx, peer1.id);
        let peers = await inReadOnlyTx(rootCtx, async (ctx) => await Store.ConferencePeer.conference.findAll(ctx, CID));
        expect(peers.length).toBe(1);
        expect(peers[0].id).toBe(peer2.id);
        // let connections = await Store.ConferenceConnection.conference.findAll(ctx, CID);
        // expect(connections.length).toBe(0);
    });

    // it('should accept offers', async () => {
    //     let ctx = createNamedContext('test');
    //     let CID = 5;
    //     let repo = container.get(CallRepository);
    //     let peer1 = await repo.addPeer(ctx, CID, 3, 'tid1', 5000);
    //     let peer2 = await repo.addPeer(ctx, CID, 4, 'tid2', 5000);
    //     await repo.connectionOffer(ctx, CID, peer1.id, peer2.id, 'offer-value');
    //     let connection = (await Store.ConferenceConnection.findById(ctx, peer1.id, peer2.id))!;
    //     expect(connection).not.toBeNull();
    //     expect(connection).not.toBeUndefined();
    //     expect(connection.state).toEqual('wait-answer');
    //     expect(connection.offer).toEqual('offer-value');
    //     expect(connection.answer).toBeNull();
    // });

    // it('should crash if offer came from the wrong side', async () => {
    //     let ctx = createNamedContext('test');
    //     let CID = 6;
    //     let repo = container.get(CallRepository);
    //     let peer1 = await repo.addPeer(ctx, CID, 3, 'tid1', 5000);
    //     let peer2 = await repo.addPeer(ctx, CID, 4, 'tid2', 5000);
    //     await expect(repo.connectionOffer(ctx, CID, peer2.id, peer1.id, 'offer-value')).rejects.toThrowError();
    //     let connection = (await Store.ConferenceConnection.findById(ctx, peer1.id, peer2.id))!;
    //     expect(connection).not.toBeNull();
    //     expect(connection).not.toBeUndefined();
    //     expect(connection.state).toEqual('wait-offer');
    //     expect(connection.offer).toBeNull();
    //     expect(connection.answer).toBeNull();
    // });

    // it('should accept answer', async () => {
    //     let ctx = createNamedContext('test');
    //     let CID = 7;
    //     let repo = container.get(CallRepository);
    //     let peer1 = await repo.addPeer(ctx, CID, 3, 'tid1', 5000);
    //     let peer2 = await repo.addPeer(ctx, CID, 4, 'tid2', 5000);
    //     await repo.connectionOffer(ctx, CID, peer1.id, peer2.id, 'offer-value');
    //     await repo.connectionAnswer(ctx, CID, peer2.id, peer1.id, 'answer-value');
    //     let connection = (await Store.ConferenceConnection.findById(ctx, peer1.id, peer2.id))!;
    //     expect(connection).not.toBeNull();
    //     expect(connection).not.toBeUndefined();
    //     expect(connection.state).toEqual('online');
    //     expect(connection.offer).toEqual('offer-value');
    //     expect(connection.answer).toEqual('answer-value');
    // });

    // it('should accept ICE', async () => {
    //     let ctx = createNamedContext('test');
    //     let CID = 7;
    //     let repo = container.get(CallRepository);
    //     let peer1 = await repo.addPeer(ctx, CID, 3, 'tid1', 5000);
    //     let peer2 = await repo.addPeer(ctx, CID, 4, 'tid2', 5000);
    //     await repo.connectionCandidate(ctx, CID, peer1.id, peer2.id, 'candidate-1');
    //     await repo.connectionCandidate(ctx, CID, peer1.id, peer2.id, 'candidate-2');
    //     await repo.connectionCandidate(ctx, CID, peer1.id, peer2.id, 'candidate-3');
    //     let connection = (await Store.ConferenceConnection.findById(ctx, peer1.id, peer2.id))!;
    //     expect(connection).not.toBeNull();
    //     expect(connection).not.toBeUndefined();
    //     expect(connection.ice1.length).toBe(3);
    //     expect(connection.ice1[0]).toEqual('candidate-1');
    //     expect(connection.ice1[1]).toEqual('candidate-2');
    //     expect(connection.ice1[2]).toEqual('candidate-3');
    // });
});