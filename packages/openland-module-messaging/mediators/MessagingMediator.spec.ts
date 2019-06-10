import { randomTestUser, testEnvironmentEnd, testEnvironmentStart } from 'openland-modules/testEnvironment';
import { container } from 'openland-modules/Modules.container';
import { RoomMediator } from './RoomMediator';
import { FDB } from 'openland-module-db/FDB';
import { loadMessagingTestModule } from 'openland-module-messaging/Messaging.container.test';
import { UsersModule } from 'openland-module-users/UsersModule';
import { MessagingMediator } from './MessagingMediator';
import *  as ChatResolver from '../resolvers/Chat.resolver';
import { OrganizationModule } from 'openland-module-organization/OrganizationModule';
import { OrganizationRepository } from 'openland-module-organization/repositories/OrganizationRepository';
import { UserRepository } from 'openland-module-users/repositories/UserRepository';
import { SuperModule } from 'openland-module-super/SuperModule';
import { MessageAttachmentInput, MessageRichAttachmentInput } from '../MessageInput';
import { createUrlInfoService } from '../workers/UrlInfoService';
import { Modules } from '../../openland-modules/Modules';
import { MediaModule } from '../../openland-module-media/MediaModule';
import { IDs } from '../../openland-module-api/IDs';
import { createNamedContext } from '@openland/context';

describe('MessagingMediator', () => {
    beforeAll(async () => {
        await testEnvironmentStart('messaging-mediator');
        loadMessagingTestModule();
        container.bind(UsersModule).toSelf().inSingletonScope();
        container.bind('UserRepository').to(UserRepository).inSingletonScope();
        container.bind(OrganizationModule).toSelf().inSingletonScope();
        container.bind(SuperModule).toSelf().inSingletonScope();
        container.bind(MediaModule).toSelf().inSingletonScope();
        container.bind('OrganizationRepository').to(OrganizationRepository).inSingletonScope();
    });
    afterAll(() => {
        testEnvironmentEnd();
    });

    it('should send message', async () => {
        let ctx = createNamedContext('test');
        let roooms = container.get<RoomMediator>('RoomMediator');
        let mediator = container.get<MessagingMediator>('MessagingMediator');
        let users = container.get<UsersModule>(UsersModule);
        let USER_ID = (await users.createUser(ctx, 'user' + Math.random(), 'email' + Math.random())).id;
        await users.createUserProfile(ctx, USER_ID, { firstName: 'User Name' + Math.random() });
        let org = await Modules.Orgs.createOrganization(ctx, USER_ID, { name: '1' });
        let room = await roooms.createRoom(ctx, 'public', org.id, USER_ID, [], { title: 'Room' });

        let text = 'boom';
        let message = (await FDB.Message.findById(ctx, (await mediator.sendMessage(ctx, USER_ID, room.id, { message: text })).mid!))!;

        let textResolved = await ChatResolver.default.ConversationMessage!.message!(message, {}, {} as any);

        expect(textResolved).toEqual(text);

    });

    it('should set and reset reaction', async () => {
        let ctx = createNamedContext('test');
        let roooms = container.get<RoomMediator>('RoomMediator');
        let mediator = container.get<MessagingMediator>('MessagingMediator');
        let USER_ID = (await randomTestUser(ctx)).uid;
        let org = await Modules.Orgs.createOrganization(ctx, USER_ID, { name: '1' });
        let room = await roooms.createRoom(ctx, 'public', org.id, USER_ID, [], { title: 'Room' });

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
        let ctx = createNamedContext('test');
        let roooms = container.get<RoomMediator>('RoomMediator');
        let mediator = container.get<MessagingMediator>('MessagingMediator');
        let USER_ID = (await randomTestUser(ctx)).uid;
        let org = await Modules.Orgs.createOrganization(ctx, USER_ID, { name: '1' });
        let room = await roooms.createRoom(ctx, 'public', org.id, USER_ID, [], { title: 'Room' });

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
        let ctx = createNamedContext('test');
        let roooms = container.get<RoomMediator>('RoomMediator');
        let mediator = container.get<MessagingMediator>('MessagingMediator');
        let USER_ID = (await randomTestUser(ctx)).uid;
        let org = await Modules.Orgs.createOrganization(ctx, USER_ID, { name: '1' });
        let room = await roooms.createRoom(ctx, 'public', org.id, USER_ID, [], { title: 'Room' });

        let service = createUrlInfoService();
        let urlInfo = (await service.fetchURLInfo('https://openland.com/directory/u/' + IDs.User.serialize(USER_ID)))!;
        let richAttachment: MessageRichAttachmentInput = {
            type: 'rich_attachment',
            title: urlInfo.title || null,
            titleLink: urlInfo.url,
            titleLinkHostname: urlInfo.hostname || null,
            subTitle: urlInfo.subtitle || null,
            text: urlInfo.description || null,
            icon: urlInfo.iconRef || null,
            iconInfo: urlInfo.iconInfo || null,
            image: urlInfo.photo || null,
            imageInfo: urlInfo.imageInfo || null,
            keyboard: urlInfo.keyboard || null,
        };

        let MSG_ID = (await mediator.sendMessage(ctx, USER_ID, room.id, { message: 'boom', attachments: [richAttachment] })).mid!;

        let message = (await FDB.Message.findById(ctx, MSG_ID))!;
        let augmentationResolved = await ChatResolver.default.ConversationMessage!.urlAugmentation!(message, {}, {} as any);
        // expect(augmentationResolved).toEqual(augmentation);

        let newAttachments: MessageAttachmentInput[] = [];

        if (message.attachmentsModern) {
            newAttachments = message.attachmentsModern.filter(a => a.type !== 'rich_attachment').map(a => {
                delete a.id;
                return a;
            });
        }

        await mediator.editMessage(ctx, MSG_ID, USER_ID, { attachments: newAttachments }, false);

        message = (await FDB.Message.findById(ctx, MSG_ID))!;
        augmentationResolved = await ChatResolver.default.ConversationMessage!.urlAugmentation!(message, {}, {} as any);
        expect(augmentationResolved).toBeNull();

    });

    it('history pagination should work correctly', async () => {
        let ctx = createNamedContext('test');
        let roooms = container.get<RoomMediator>('RoomMediator');
        let mediator = container.get<MessagingMediator>('MessagingMediator');
        let USER_ID = (await randomTestUser(ctx)).uid;
        let org = await Modules.Orgs.createOrganization(ctx, USER_ID, { name: '1' });
        let room = await roooms.createRoom(ctx, 'public', org.id, USER_ID, [], { title: 'Room' });

        for (let i = 0; i < 4; i++) {
            await FDB.Message.findById(ctx, (await mediator.sendMessage(ctx, USER_ID, room.id, { message: i.toString() })).mid!);
        }

        // load history first pack
        let range = await FDB.Message.rangeFromChat(ctx, room.id, 2, true);
        expect(range[0].text).toEqual('3');
        expect(range[1].text).toEqual('2');

        // load range before oldest message in prev range
        range = await FDB.Message.rangeFromChatAfter(ctx, room.id, range[1].id, 2, true);

        expect(range[0].text).toEqual('1');
        expect(range[1].text).toEqual('0');

    });

});