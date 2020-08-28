import { Store } from '../../openland-module-db/FDB';
import { testEnvironmentStart, testEnvironmentEnd } from 'openland-modules/testEnvironment';
import { container } from 'openland-modules/Modules.container';
import { RoomRepository } from './RoomRepository';
import { createNamedContext } from '@openland/context';
import { DeliveryMediator } from '../mediators/DeliveryMediator';
import { UsersModule } from '../../openland-module-users/UsersModule';
import { loadUsersModule } from '../../openland-module-users/UsersModule.container';
import { FastCountersRepository } from './FastCountersRepository';
import { FastCountersMediator } from '../mediators/FastCountersMediator';
jest.mock('../mediators/DeliveryMediator', () => ({
    DeliveryMediator: jest.fn(() => {
        return {
            onDialogGotAccess: jest.fn(),
            onDialogLostAccess: jest.fn()
        };
    })
}));

describe('RoomRepository', () => {
    beforeAll(async () => {
        await testEnvironmentStart('room-repo');
        container.bind('RoomRepository').to(RoomRepository).inSingletonScope();
        container.bind('DeliveryMediator').toConstantValue(new DeliveryMediator());
        container.bind('FastCountersRepository').to(FastCountersRepository).inSingletonScope();
        container.bind('FastCountersMediator').to(FastCountersMediator).inSingletonScope();
        container.bind(UsersModule).toSelf().inSingletonScope();
        loadUsersModule();
    });
    afterAll( async () => {
      await  testEnvironmentEnd();
    });
    it('should create rooms', async () => {
        let ctx = createNamedContext('test');
        let repo = container.get<RoomRepository>('RoomRepository');
        let USER_ID = 2;
        let ORG_ID = 1;
        let conv = await repo.createRoom(ctx, 'public', ORG_ID, USER_ID, [USER_ID, 5, 6, 7], {
            title: 'Room name ',
            description: 'Room description',
            image: 'Some random image ref',
            socialImage: 'Some random social image ref'
        });

        // Conversation
        expect(conv.kind).toEqual('room');

        // Room
        let room = (await Store.ConversationRoom.findById(ctx, conv.id))!;
        expect(room.kind).toEqual('public');
        expect(room.oid).toEqual(ORG_ID);
        expect(room.ownerId).toEqual(USER_ID);
        expect(room.listed).toEqual(true);
        expect(room.featured).toEqual(false);

        // Room profile
        let roomProfile = (await Store.RoomProfile.findById(ctx, conv.id))!;
        expect(roomProfile).not.toBeNull();
        expect(roomProfile).not.toBeUndefined();
        expect(roomProfile.title).toEqual('Room name '); // No preprocessing
        expect(roomProfile.description).toEqual('Room description');
        expect(roomProfile.image).toEqual('Some random image ref');
        expect(roomProfile.socialImage).toEqual('Some random social image ref');

        // Room members
        let members = await Store.RoomParticipant.active.findAll(ctx, conv.id);
        let requests = await Store.RoomParticipant.requests.findAll(ctx, conv.id);
        expect(requests.length).toBe(0);
        expect(members.length).toBe(4);
        for (let m of members) {
            expect(m.cid).toEqual(conv.id);
            expect(m.status).toEqual('joined');
            expect(m.invitedBy).toEqual(USER_ID);
            if (m.uid === USER_ID) {
                expect(m.role).toEqual('owner');
            } else {
                expect(m.role).toEqual('member');
            }
        }
    });

    it('should add members', async () => {
        let ctx = createNamedContext('test');
        let repo = container.get<RoomRepository>('RoomRepository');
        let USER_ID = 2;
        let ORG_ID = 1;
        let conv = await repo.createRoom(ctx, 'public', ORG_ID, USER_ID, [], { title: 'Room' });

        expect(await repo.addToRoom(ctx, conv.id, 3, USER_ID)).toBe(true);
        expect(await repo.addToRoom(ctx, conv.id, 3, USER_ID)).toBe(false); // Double invoke
        expect(await repo.addToRoom(ctx, conv.id, 4, USER_ID)).toBe(true);
        expect(await repo.addToRoom(ctx, conv.id, 5, USER_ID)).toBe(true);
        let members = await Store.RoomParticipant.active.findAll(ctx, conv.id);
        expect(members.length).toBe(4);
        for (let m of members) {
            expect(m.cid).toEqual(conv.id);
            expect(m.status).toEqual('joined');
            expect(m.invitedBy).toEqual(USER_ID);
            if (m.uid === USER_ID) {
                expect(m.role).toEqual('owner');
            } else {
                expect(m.role).toEqual('member');
            }
        }
    });

    it('should kick members', async () => {
        let ctx = createNamedContext('test');
        let repo = container.get<RoomRepository>('RoomRepository');
        let USER_ID = 2;
        let ORG_ID = 1;
        let conv = await repo.createRoom(ctx, 'public', ORG_ID, USER_ID, [3, 4, 5], { title: 'Room' });
        expect(await repo.kickFromRoom(ctx, conv.id, 3)).toBe(true);
        expect(await repo.kickFromRoom(ctx, conv.id, 3)).toBe(false); // Double invoke
        expect(await repo.kickFromRoom(ctx, conv.id, 4)).toBe(true);
        expect(await repo.kickFromRoom(ctx, conv.id, 5)).toBe(true);
        expect((await Store.RoomParticipant.active.findAll(ctx, conv.id)).length).toBe(1);
    });

    it('should be able to leave room', async () => {
        let ctx = createNamedContext('test');
        let repo = container.get<RoomRepository>('RoomRepository');
        let USER_ID = 2;
        let ORG_ID = 1;
        let conv = await repo.createRoom(ctx, 'public', ORG_ID, USER_ID, [3, 4, 5], { title: 'Room' });
        expect(await repo.leaveRoom(ctx, conv.id, 3)).toBe(true);
        expect(await repo.leaveRoom(ctx, conv.id, 3)).toBe(false); // Double invoke
        expect(await repo.leaveRoom(ctx, conv.id, 4)).toBe(true);
        expect(await repo.leaveRoom(ctx, conv.id, 5)).toBe(true);
        expect((await Store.RoomParticipant.active.findAll(ctx, conv.id)).length).toBe(1);
    });

    it('should update inivited by value on re-adding user to a room', async () => {
        let ctx = createNamedContext('test');
        let repo = container.get<RoomRepository>('RoomRepository');
        let USER_ID = 2;
        let USER2_ID = 3;
        let USER3_ID = 4;
        let ORG_ID = 1;
        let conv = await repo.createRoom(ctx, 'public', ORG_ID, USER_ID, [], { title: 'Room' });
        expect(await repo.addToRoom(ctx, conv.id, USER2_ID, USER_ID)).toBe(true);
        expect(await repo.leaveRoom(ctx, conv.id, USER2_ID)).toBe(true);
        expect(await repo.addToRoom(ctx, conv.id, USER2_ID, USER3_ID)).toBe(true); // No membeship validation of inviter

        let members = await Store.RoomParticipant.active.findAll(ctx, conv.id);
        expect(members.length).toBe(2);
        for (let m of members) {
            expect(m.cid).toEqual(conv.id);
            expect(m.status).toEqual('joined');
            if (m.uid === USER2_ID) {
                expect(m.invitedBy).toEqual(USER3_ID);
            } else {
                expect(m.invitedBy).toEqual(USER_ID);
            }
            if (m.uid === USER_ID) {
                expect(m.role).toEqual('owner');
            } else {
                expect(m.role).toEqual('member');
            }
        }
    });

    it('should be able to join rooms', async () => {
        let ctx = createNamedContext('test');
        let repo = container.get<RoomRepository>('RoomRepository');
        let USER_ID = 2;
        let USER2_ID = 3;
        let ORG_ID = 1;
        let conv = await repo.createRoom(ctx, 'public', ORG_ID, USER_ID, [], { title: 'Room' });
        expect(await repo.joinRoom(ctx, conv.id, USER2_ID)).toBe(true);
        expect(await repo.joinRoom(ctx, conv.id, USER2_ID)).toBe(false);

        let members = await Store.RoomParticipant.active.findAll(ctx, conv.id);
        expect(members.length).toBe(2);
        for (let m of members) {
            expect(m.cid).toEqual(conv.id);
            expect(m.status).toEqual('joined');
            expect(m.invitedBy).toEqual(m.uid);
            if (m.uid === USER_ID) {
                expect(m.role).toEqual('owner');
            } else {
                expect(m.role).toEqual('member');
            }
        }
    });

    it('should should crash if room does not exist', async () => {
        let ctx = createNamedContext('test');
        let repo = container.get<RoomRepository>('RoomRepository');
        await expect(repo.checkRoomExists(ctx, 100000)).rejects.toThrowError();
    });
});