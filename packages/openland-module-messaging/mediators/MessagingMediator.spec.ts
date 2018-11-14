import { testEnvironmentEnd, testEnvironmentStart } from 'openland-modules/testEnvironment';
import { container } from 'openland-modules/Modules.container';
import { RoomMediator } from './RoomMediator';
import { FDB } from 'openland-module-db/FDB';
import { loadMessagingTestModule } from 'openland-module-messaging/Messaging.container.test';
import { UsersModule } from 'openland-module-users/UsersModule';
import { MessagingMediator } from './MessagingMediator';
import *  as ChatResolver from '../resolvers/Chat.resolver';

describe('MessagingMediator', () => {
    beforeAll(async () => {
        await testEnvironmentStart('messaging-mediator');
        loadMessagingTestModule();
        container.bind(UsersModule).toSelf().inSingletonScope();
    });
    afterAll(() => {
        testEnvironmentEnd();
    });

    it('should send message', async () => {
        let roooms = container.get<RoomMediator>('RoomMediator');
        let users = container.get<UsersModule>(UsersModule);
        let mediator = container.get<MessagingMediator>('MessagingMediator');
        let USER_ID = (await users.createUser('user_test_messages_1', 'email_user_test_messages_1')).id;
        let room = await roooms.createRoom('public', 1, USER_ID, [], { title: 'Room' });

        let text = 'boom';
        let message = (await FDB.Message.findById((await mediator.sendMessage(USER_ID, room.id, { message: text })).mid!))!;

        let textResolved = await ChatResolver.default.ConversationMessage!.message(message);

        expect(textResolved).toEqual(text);

    });

    it('should set and reset reaction', async () => {
        let roooms = container.get<RoomMediator>('RoomMediator');
        let users = container.get<UsersModule>(UsersModule);
        let mediator = container.get<MessagingMediator>('MessagingMediator');
        let USER_ID = (await users.createUser('user_test_messages_2', 'email_user_test_messages_2')).id;
        let room = await roooms.createRoom('public', 1, USER_ID, [], { title: 'Room' });

        let text = 'boom';
        let MSG_ID = (await mediator.sendMessage(USER_ID, room.id, { message: text })).mid!;

        await mediator.setReaction(MSG_ID, USER_ID, '❤️');
        let message = (await FDB.Message.findById(MSG_ID))!;

        let reactionsResolved = await ChatResolver.default.ConversationMessage!.reactions(message);
        expect(reactionsResolved[0].reaction).toEqual('❤️');

        await mediator.setReaction(MSG_ID, USER_ID, '❤️', true);
        message = (await FDB.Message.findById(MSG_ID))!;

        reactionsResolved = await ChatResolver.default.ConversationMessage!.reactions(message);
        expect(reactionsResolved.length).toEqual(0);
    });

    it('should edit message', async () => {
        let roooms = container.get<RoomMediator>('RoomMediator');
        let users = container.get<UsersModule>(UsersModule);
        let mediator = container.get<MessagingMediator>('MessagingMediator');
        let USER_ID = (await users.createUser('user_test_messages_edit_message', 'email_user_test_messages_edit_message')).id;
        let room = await roooms.createRoom('public', 1, USER_ID, [], { title: 'Room' });

        let MSG_ID = (await mediator.sendMessage(USER_ID, room.id, { message: 'boom' })).mid!;

        let message = (await FDB.Message.findById(MSG_ID))!;
        let textResolved = await ChatResolver.default.ConversationMessage!.message(message);
        expect(textResolved).toEqual('boom');

        await mediator.editMessage(MSG_ID, USER_ID, { message: 'boom shakalaka' }, false);

        message = (await FDB.Message.findById(MSG_ID))!;
        textResolved = await ChatResolver.default.ConversationMessage!.message(message);
        expect(textResolved).toEqual('boom shakalaka');

    });

    it('should delete url augmentation', async () => {
        let roooms = container.get<RoomMediator>('RoomMediator');
        let users = container.get<UsersModule>(UsersModule);
        let mediator = container.get<MessagingMediator>('MessagingMediator');
        let USER_ID = (await users.createUser('user_test_messages_del_aug', 'email_user_test_messages_del_aug')).id;
        let room = await roooms.createRoom('public', 1, USER_ID, [], { title: 'Room' });

        let augmentation = { url: 'openland.com', title: 'openland' };
        let MSG_ID = (await mediator.sendMessage(USER_ID, room.id, { message: 'boom', urlAugmentation: augmentation as any })).mid!;

        let message = (await FDB.Message.findById(MSG_ID))!;
        let augmentationResolved = await ChatResolver.default.ConversationMessage!.urlAugmentation(message);
        expect(augmentationResolved).toEqual(augmentation);

        await mediator.editMessage(MSG_ID, USER_ID, { urlAugmentation: false }, false);

        message = (await FDB.Message.findById(MSG_ID))!;
        augmentationResolved = await ChatResolver.default.ConversationMessage!.urlAugmentation(message);
        expect(augmentationResolved).toBeNull();

    });


});