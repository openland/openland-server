import { testEnvironmentStart, testEnvironmentEnd } from 'openland-modules/testEnvironment';
import { container } from 'openland-modules/Modules.container';
import { MessagingRepository } from './MessagingRepository';
import { AllEntities } from 'openland-module-db/schema';
import { UserStateRepository } from './UserStateRepository';
import { EmptyContext } from '@openland/context';

describe('MessagingRepository', () => {
    beforeAll(async () => {
        await testEnvironmentStart('messaging-repo');
        container.bind('MessagingRepository').to(MessagingRepository).inSingletonScope();
        container.bind('UserStateRepository').to(UserStateRepository).inSingletonScope();
    });
    afterAll(() => {
        testEnvironmentEnd();
    });

    it('should create message and event', async () => {
        let ctx = EmptyContext;
        let repo = container.get<MessagingRepository>('MessagingRepository');
        let entities = container.get<AllEntities>('FDB');
        let res = (await repo.createMessage(ctx, 1, 2, { message: 'text' }));
        expect(res).not.toBeNull();
        expect(res).not.toBeUndefined();
        expect(res.event.cid).toBe(1);
        expect(res.event.uid).toBe(2);
        expect(res.event.kind).toBe('message_received');
        expect(res.event.seq).toBe(1);
        expect(res.event.mid).toBe(res.message.id);
        expect(res.message.uid).toBe(2);
        expect(res.message.text).toBe('text');

        let events = await entities.ConversationEvent.allFromUser(ctx, 1);
        expect(events.length).toBe(1);
        expect(events[0].seq).toBe(res.event.seq);
        expect(events[0].mid).toBe(res.message.id);
        expect(events[0].kind).toBe('message_received');
    });
});