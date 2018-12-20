import { testEnvironmentEnd, testEnvironmentStart } from 'openland-modules/testEnvironment';
import { container } from 'openland-modules/Modules.container';
import { RoomMediator } from './RoomMediator';
import { FDB } from 'openland-module-db/FDB';
import { loadMessagingTestModule } from 'openland-module-messaging/Messaging.container.test';
import { UsersModule } from 'openland-module-users/UsersModule';
import { MessagingMediator } from './MessagingMediator';
import *  as ChatResolver from '../resolvers/Chat.resolver';
import { createEmptyContext } from 'openland-utils/Context';
import { UserRepository } from 'openland-module-users/repositories/UserRepository';

describe('MessagingMediator', () => {
    beforeAll(async () => {
        await testEnvironmentStart('messaging-mediator');
        loadMessagingTestModule();
        container.bind(UsersModule).toSelf().inSingletonScope();
        container.bind('UserRepository').to(UserRepository).inSingletonScope();
    });
    afterAll(() => {
        testEnvironmentEnd();
    });

    it('should send message', async () => {
        let ctx = createEmptyContext();
        let roooms = container.get<RoomMediator>('RoomMediator');
        let users = container.get<UsersModule>(UsersModule);
        let mediator = container.get<MessagingMediator>('MessagingMediator');
        let USER_ID = (await users.createUser(ctx, 'user_test_messages_1', 'email_user_test_messages_1')).id;
        let room = await roooms.createRoom(ctx, 'public', 1, USER_ID, [], { title: 'Room' });

        let text = 'boom';
        let message = (await FDB.Message.findById(ctx, (await mediator.sendMessage(ctx, USER_ID, room.id, { message: text })).mid!))!;

        let textResolved = await ChatResolver.default.ConversationMessage!.message!(message, {}, {} as any);

        expect(textResolved).toEqual(text);

    });

    it('should set and reset reaction', async () => {
        let ctx = createEmptyContext();
        let roooms = container.get<RoomMediator>('RoomMediator');
        let users = container.get<UsersModule>(UsersModule);
        let mediator = container.get<MessagingMediator>('MessagingMediator');
        let USER_ID = (await users.createUser(ctx, 'user_test_messages_2', 'email_user_test_messages_2')).id;
        let room = await roooms.createRoom(ctx, 'public', 1, USER_ID, [], { title: 'Room' });

        let text = 'boom';
        let MSG_ID = (await mediator.sendMessage(ctx, USER_ID, room.id, { message: text })).mid!;

        await mediator.setReaction(ctx, MSG_ID, USER_ID, '❤️');
        let message = (await FDB.Message.findById(ctx, MSG_ID))!;

        let reactionsResolved = await ChatResolver.default.ConversationMessage!.reactions!(message, {}, {} as any);
        expect(reactionsResolved[0].reaction).toEqual('❤️');

        await mediator.setReaction(ctx, MSG_ID, USER_ID, '❤️', true);
        message = (await FDB.Message.findById(ctx, MSG_ID))!;

        reactionsResolved = await ChatResolver.default.ConversationMessage!.reactions!(message, {}, {} as any);
        expect(reactionsResolved.length).toEqual(0);
    });

    it('should edit message', async () => {
        let ctx = createEmptyContext();
        let roooms = container.get<RoomMediator>('RoomMediator');
        let users = container.get<UsersModule>(UsersModule);
        let mediator = container.get<MessagingMediator>('MessagingMediator');
        let USER_ID = (await users.createUser(ctx, 'user_test_messages_edit_message', 'email_user_test_messages_edit_message')).id;
        let room = await roooms.createRoom(ctx, 'public', 1, USER_ID, [], { title: 'Room' });

        let MSG_ID = (await mediator.sendMessage(ctx, USER_ID, room.id, { message: 'boom' })).mid!;

        let message = (await FDB.Message.findById(ctx, MSG_ID))!;
        let textResolved = await ChatResolver.default.ConversationMessage!.message!(message, {}, {} as any);
        expect(textResolved).toEqual('boom');

        await mediator.editMessage(ctx, MSG_ID, USER_ID, { message: 'boom shakalaka' }, false);

        message = (await FDB.Message.findById(ctx, MSG_ID))!;
        textResolved = await ChatResolver.default.ConversationMessage!.message!(message, {}, {} as any);
        expect(textResolved).toEqual('boom shakalaka');

    });

    it('should delete url augmentation', async () => {
        let ctx = createEmptyContext();
        let roooms = container.get<RoomMediator>('RoomMediator');
        let users = container.get<UsersModule>(UsersModule);
        let mediator = container.get<MessagingMediator>('MessagingMediator');
        let USER_ID = (await users.createUser(ctx, 'user_test_messages_del_aug', 'email_user_test_messages_del_aug')).id;
        let room = await roooms.createRoom(ctx, 'public', 1, USER_ID, [], { title: 'Room' });

        let augmentation = { url: 'openland.com', title: 'openland' };
        let MSG_ID = (await mediator.sendMessage(ctx, USER_ID, room.id, { message: 'boom', urlAugmentation: augmentation as any })).mid!;

        let message = (await FDB.Message.findById(ctx, MSG_ID))!;
        let augmentationResolved = await ChatResolver.default.ConversationMessage!.urlAugmentation!(message, {}, {} as any);
        expect(augmentationResolved).toEqual(augmentation);

        await mediator.editMessage(ctx, MSG_ID, USER_ID, { urlAugmentation: false }, false);

        message = (await FDB.Message.findById(ctx, MSG_ID))!;
        augmentationResolved = await ChatResolver.default.ConversationMessage!.urlAugmentation!(message, {}, {} as any);
        expect(augmentationResolved).toBeNull();

    });

});