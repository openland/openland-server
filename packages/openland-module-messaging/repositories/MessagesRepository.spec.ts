import { testEnvironmentStart, testEnvironmentEnd } from 'openland-modules/testEnvironment';
import { container } from 'openland-modules/Modules.container';
import { MessagesRepository } from './MessagesRepository';
import { UserStateRepository } from './UserStateRepository';
import { createNamedContext } from '@openland/context';
import { ChatMetricsRepository } from './ChatMetricsRepository';
import { loadUsersModule } from '../../openland-module-users/UsersModule.container';
import { UsersModule } from '../../openland-module-users/UsersModule';

describe('MessagesRepository', () => {
    beforeAll(async () => {
        await testEnvironmentStart('messaging-repo');
        container.bind('MessagesRepository').to(MessagesRepository).inSingletonScope();
        container.bind('UserStateRepository').to(UserStateRepository).inSingletonScope();
        container.bind('ChatMetricsRepository').to(ChatMetricsRepository).inSingletonScope();
        container.bind(UsersModule).toSelf().inSingletonScope();
        loadUsersModule();
    });
    afterAll( async () => {
      await  testEnvironmentEnd();
    });

    it('should create message and event', async () => {
        let ctx = createNamedContext('test');
        let repo = container.get<MessagesRepository>('MessagesRepository');
        let res = (await repo.createMessage(ctx, 1, 2, { message: 'text' }));
        expect(res).not.toBeNull();
        expect(res).not.toBeUndefined();
        expect(res.message.cid).toBe(1);
        expect(res.message.uid).toBe(2);
        // expect(res.event.kind).toBe('message_received');
        // expect(res.event.seq).toBe(1);
        // expect(res.event.mid).toBe(res.message.id);
        expect(res.message.uid).toBe(2);
        expect(res.message.text).toBe('text');

        // let events = await Store.ConversationEvent.user.findAll(ctx, 1);
        // expect(events.length).toBe(1);
        // // expect(events[0].seq).toBe(res.event.seq);
        // expect(events[0].mid).toBe(res.message.id);
        // expect(events[0].kind).toBe('message_received');
    });
});