import { randomTestUser, testEnvironmentEnd, testEnvironmentStart } from 'openland-modules/testEnvironment';
import { container } from 'openland-modules/Modules.container';
import { RoomMediator } from './RoomMediator';
import { loadMessagingTestModule } from 'openland-module-messaging/Messaging.container.test';
import { UsersModule } from 'openland-module-users/UsersModule';
import { MessagingMediator } from './MessagingMediator';
import *  as ChatResolver from '../resolvers/Chat.resolver';
import { OrganizationModule } from 'openland-module-organization/OrganizationModule';
import { OrganizationRepository } from 'openland-module-organization/repositories/OrganizationRepository';
import { SuperModule } from 'openland-module-super/SuperModule';
import { MessageAttachmentInput, MessageRichAttachmentInput } from '../MessageInput';
import { createUrlInfoService } from '../workers/UrlInfoService';
import { Modules } from '../../openland-modules/Modules';
import { MediaModule } from '../../openland-module-media/MediaModule';
import { IDs } from '../../openland-module-api/IDs';
import { createNamedContext } from '@openland/context';
import { loadUsersModule } from '../../openland-module-users/UsersModule.container';
import { Store } from 'openland-module-db/FDB';

describe('MessagingMediator', () => {
    beforeAll(async () => {
        await testEnvironmentStart('messaging-mediator');
        loadMessagingTestModule();
        container.bind(UsersModule).toSelf().inSingletonScope();
        loadUsersModule();
        container.bind(OrganizationModule).toSelf().inSingletonScope();
        container.bind(SuperModule).toSelf().inSingletonScope();
        container.bind(MediaModule).toSelf().inSingletonScope();
        container.bind('OrganizationRepository').to(OrganizationRepository).inSingletonScope();
    });
    afterAll(async () => {
        await testEnvironmentEnd();
    });

    it('should send message', async () => {
        let ctx = createNamedContext('test');
        let roooms = container.get<RoomMediator>('RoomMediator');
        let mediator = container.get<MessagingMediator>('MessagingMediator');
        let users = container.get<UsersModule>(UsersModule);
        let USER_ID = (await users.createUser(ctx, { email: 'email' + Math.random() })).id;
        await users.createUserProfile(ctx, USER_ID, { firstName: 'User Name' + Math.random() });
        await Modules.Events.mediator.prepareUser(ctx, USER_ID);
        let org = await Modules.Orgs.createOrganization(ctx, USER_ID, { name: '1' });
        let room = await roooms.createRoom(ctx, 'public', org.id, USER_ID, [], { title: 'Room' });

        let text = 'boom';
        let message = (await Store.Message.findById(ctx, (await mediator.sendMessage(ctx, USER_ID, room.id, { message: text })).id))!;

        let textResolved = await ChatResolver.Resolver.ConversationMessage!.message!(message, {}, {} as any);

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
        let MSG_ID = (await mediator.sendMessage(ctx, USER_ID, room.id, { message: text })).id;

        await mediator.setReaction(ctx, MSG_ID, USER_ID, 'LIKE');
        let message = (await Store.Message.findById(ctx, MSG_ID))!;

        let reactionsResolved = await ChatResolver.Resolver.ConversationMessage!.reactions!(message, {}, {} as any);
        expect(reactionsResolved[0].reaction).toEqual('LIKE');

        await mediator.setReaction(ctx, MSG_ID, USER_ID, 'LIKE', true);
        message = (await Store.Message.findById(ctx, MSG_ID))!;

        reactionsResolved = await ChatResolver.Resolver.ConversationMessage!.reactions!(message, {}, {} as any);
        expect(reactionsResolved.length).toEqual(0);
    });

    it('should edit message', async () => {
        let ctx = createNamedContext('test');
        let roooms = container.get<RoomMediator>('RoomMediator');
        let mediator = container.get<MessagingMediator>('MessagingMediator');
        let USER_ID = (await randomTestUser(ctx)).uid;
        let org = await Modules.Orgs.createOrganization(ctx, USER_ID, { name: '1' });
        let room = await roooms.createRoom(ctx, 'public', org.id, USER_ID, [], { title: 'Room' });

        let MSG_ID = (await mediator.sendMessage(ctx, USER_ID, room.id, { message: 'boom' })).id;

        let message = (await Store.Message.findById(ctx, MSG_ID))!;
        let textResolved = await ChatResolver.Resolver.ConversationMessage!.message!(message, {}, {} as any);
        expect(textResolved).toEqual('boom');

        await mediator.editMessage(ctx, MSG_ID, USER_ID, { message: 'boom shakalaka' }, false);

        message = (await Store.Message.findById(ctx, MSG_ID))!;
        textResolved = await ChatResolver.Resolver.ConversationMessage!.message!(message, {}, {} as any);
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
        let urlInfo = (await service.fetchURLInfo('https://openland.com/' + IDs.User.serialize(USER_ID)))!;
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
            imagePreview: urlInfo.photoPreview || null,
            keyboard: urlInfo.keyboard || null,
            imageFallback: urlInfo.photoFallback || null,
            socialImagePreview: null,
            socialImageInfo: null,
            socialImage: null,
            featuredIcon: false
        };

        let MSG_ID = (await mediator.sendMessage(ctx, USER_ID, room.id, { message: 'boom', attachments: [richAttachment] })).id;

        let message = (await Store.Message.findById(ctx, MSG_ID))!;
        let augmentationResolved = await ChatResolver.Resolver.ConversationMessage!.urlAugmentation!(message, {}, {} as any);
        // expect(augmentationResolved).toEqual(augmentation);

        let newAttachments: MessageAttachmentInput[] = [];

        if (message.attachmentsModern) {
            newAttachments = message.attachmentsModern.filter(a => a.type !== 'rich_attachment').map(a => {
                delete (a as any).id;
                return a;
            });
        }

        await mediator.editMessage(ctx, MSG_ID, USER_ID, { attachments: newAttachments }, false);

        message = (await Store.Message.findById(ctx, MSG_ID))!;
        augmentationResolved = await ChatResolver.Resolver.ConversationMessage!.urlAugmentation!(message, {}, {} as any);
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
            await Store.Message.findById(ctx, (await mediator.sendMessage(ctx, USER_ID, room.id, { message: i.toString() })).id);
        }

        // load history first pack
        let range = (await Store.Message.chat.query(ctx, room.id, { limit: 2, reverse: true })).items;
        expect(range[0].text).toEqual('3');
        expect(range[1].text).toEqual('2');

        // load range before oldest message in prev range
        range = (await Store.Message.chat.query(ctx, room.id, { after: range[1].id, limit: 2, reverse: true })).items;

        expect(range[0].text).toEqual('1');
        expect(range[1].text).toEqual('0');

    });

});
