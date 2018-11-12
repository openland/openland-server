import { testEnvironmentStart, testEnvironmentEnd } from 'openland-modules/testEnvironment';
import { container } from 'openland-modules/Modules.container';
import { RoomRepository } from './RoomRepository';
import { FDB } from 'openland-module-db/FDB';

describe('RoomRepository', () => {
    beforeAll(async () => {
        await testEnvironmentStart('room-repo');
        container.bind('RoomRepository').to(RoomRepository).inSingletonScope();
    });
    afterAll(() => {
        testEnvironmentEnd();
    });
    it('should create rooms', async () => {
        let repo = container.get<RoomRepository>('RoomRepository');
        let USER_ID = 2;
        let ORG_ID = 1;
        let conv = await repo.createRoom('public', ORG_ID, USER_ID, [USER_ID, 5, 6, 7], {
            title: 'Room name ',
            description: 'Room description',
            image: 'Some random image ref',
            socialImage: 'Some random social image ref'
        });

        // Conversation
        expect(conv.kind).toEqual('room');

        // Room
        let room = (await FDB.ConversationRoom.findById(conv.id))!;
        expect(room.kind).toEqual('public');
        expect(room.oid).toEqual(ORG_ID);
        expect(room.ownerId).toEqual(USER_ID);
        expect(room.listed).toEqual(true);
        expect(room.featured).toEqual(false);

        // Room profile
        let roomProfile = (await FDB.RoomProfile.findById(conv.id))!;
        expect(roomProfile).not.toBeNull();
        expect(roomProfile).not.toBeUndefined();
        expect(roomProfile.title).toEqual('Room name '); // No preprocessing
        expect(roomProfile.description).toEqual('Room description');
        expect(roomProfile.image).toEqual('Some random image ref');
        expect(roomProfile.socialImage).toEqual('Some random social image ref');

        // Room members
        let members = await FDB.RoomParticipant.allFromActive(conv.id);
        let requests = await FDB.RoomParticipant.allFromRequests(conv.id);
        expect(requests.length).toBe(0);
        expect(members.length).toBe(4);
        for (let m of members) {
            expect(m.cid).toEqual(conv.id);
            expect(m.status).toEqual('joined');
            if (m.uid === USER_ID) {
                expect(m.role).toEqual('owner');
            } else {
                expect(m.role).toEqual('member');
            }
        }
    });

    it('should add members', async () => {
        let repo = container.get<RoomRepository>('RoomRepository');
        let USER_ID = 2;
        let ORG_ID = 1;
        let conv = await repo.createRoom('public', ORG_ID, USER_ID, [], { title: 'Room' });

        expect(await repo.addToRoom(conv.id, 3, USER_ID)).toBe(true);
        expect(await repo.addToRoom(conv.id, 3, USER_ID)).toBe(false); // Double invoke
        expect(await repo.addToRoom(conv.id, 4, USER_ID)).toBe(true);
        expect(await repo.addToRoom(conv.id, 5, USER_ID)).toBe(true);
        expect((await FDB.RoomParticipant.allFromActive(conv.id)).length).toBe(4);
    });

    it('should kick members', async () => {
        let repo = container.get<RoomRepository>('RoomRepository');
        let USER_ID = 2;
        let ORG_ID = 1;
        let conv = await repo.createRoom('public', ORG_ID, USER_ID, [3, 4, 5], { title: 'Room' });
        expect(await repo.kickFromRoom(conv.id, 3)).toBe(true);
        expect(await repo.kickFromRoom(conv.id, 3)).toBe(false); // Double invoke
        expect(await repo.kickFromRoom(conv.id, 4)).toBe(true);
        expect(await repo.kickFromRoom(conv.id, 5)).toBe(true);
        expect((await FDB.RoomParticipant.allFromActive(conv.id)).length).toBe(1);
    });

    it('should be able to leave room', async () => {
        let repo = container.get<RoomRepository>('RoomRepository');
        let USER_ID = 2;
        let ORG_ID = 1;
        let conv = await repo.createRoom('public', ORG_ID, USER_ID, [3, 4, 5], { title: 'Room' });
        expect(await repo.leaveRoom(conv.id, 3)).toBe(true);
        expect(await repo.leaveRoom(conv.id, 3)).toBe(false); // Double invoke
        expect(await repo.leaveRoom(conv.id, 4)).toBe(true);
        expect(await repo.leaveRoom(conv.id, 5)).toBe(true);
        expect((await FDB.RoomParticipant.allFromActive(conv.id)).length).toBe(1);
    });
});