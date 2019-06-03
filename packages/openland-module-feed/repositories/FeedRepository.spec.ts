import { testEnvironmentStart } from 'openland-modules/testEnvironment';
import { FeedRepository } from './FeedRepository';
import { container } from 'openland-modules/Modules.container';
import { EmptyContext } from '@openland/context';

describe('FeedRepository', () => {
    beforeAll(async () => {
        await testEnvironmentStart('feed');
        container.bind(FeedRepository).to(FeedRepository).inSingletonScope();
    });

    it('should resolve subscribers', async () => {
        let repo = container.get(FeedRepository);
        let s1 = await repo.resolveSubscriber(EmptyContext, 'test-key-1');
        let s2 = await repo.resolveSubscriber(EmptyContext, 'test-key-1');
        let s3 = await repo.resolveSubscriber(EmptyContext, 'test-key-2');
        expect(s1.id).toEqual(s2.id);
        expect(s1.key).toEqual(s2.key);
        expect(s1.id).not.toEqual(s3.id);
        expect(s1.key).not.toEqual(s3.key);
    });

    it('should resolve topics', async () => {
        let repo = container.get(FeedRepository);
        let s1 = await repo.resolveTopic(EmptyContext, 'test-topic-1');
        let s2 = await repo.resolveTopic(EmptyContext, 'test-topic-1');
        let s3 = await repo.resolveTopic(EmptyContext, 'test-topic-2');
        expect(s1.id).toEqual(s2.id);
        expect(s1.key).toEqual(s2.key);
        expect(s1.id).not.toEqual(s3.id);
        expect(s1.key).not.toEqual(s3.key);
    });

    it('should create events', async () => {
        let repo = container.get(FeedRepository);
        let res = await repo.createEvent(EmptyContext, 'some-topic', 'test', { message: 'hello' });
        let topic = await repo.resolveTopic(EmptyContext, 'some-topic');
        expect(res.type).toEqual('test');
        expect(res.tid).toEqual(topic.id);
        expect(res.content.message).toEqual('hello');
    });

    it('should subscribe and unsubscribe', async () => {
        let repo = container.get(FeedRepository);
        let t = await repo.resolveTopic(EmptyContext, 'test-topic-8');
        let subs = await repo.findSubscriptions(EmptyContext, 'sub-key-1');
        for (let s of subs) {
            expect(s).not.toBe(t.id);
        }
        await repo.subsctibe(EmptyContext, 'sub-key-1', 'test-topic-8');
        subs = await repo.findSubscriptions(EmptyContext, 'sub-key-1');
        let exists = false;
        for (let s of subs) {
            if (s === t.id) {
                exists = true;
                break;
            }
        }
        expect(exists).toBeTruthy();

        await repo.unsubscribe(EmptyContext, 'sub-key-1', 'test-topic-8');
        subs = await repo.findSubscriptions(EmptyContext, 'sub-key-1');
        for (let s of subs) {
            expect(s).not.toBe(t.id);
        }
    });

    it('should subscribe to self on subscriber creation', async () => {
        let repo = container.get(FeedRepository);
        await repo.resolveSubscriber(EmptyContext, 'test-key-3');
        let t1 = await repo.resolveTopic(EmptyContext, 'test-key-3');
        let subs = (await repo.findSubscriptions(EmptyContext, 'test-key-3'));
        expect(subs.length).toBe(1);
        expect(subs[0]).toBe(t1.id);
    });
});