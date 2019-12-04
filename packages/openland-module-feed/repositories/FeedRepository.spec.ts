import { testEnvironmentStart } from 'openland-modules/testEnvironment';
import { FeedRepository } from './FeedRepository';
import { container } from 'openland-modules/Modules.container';
import { createNamedContext } from '@openland/context';

describe('FeedRepository', () => {
    beforeAll(async () => {
        await testEnvironmentStart('feed');
        container.bind(FeedRepository).to(FeedRepository).inSingletonScope();
    });

    it('should resolve subscribers', async () => {
        let repo = container.get(FeedRepository);
        let s1 = await repo.resolveSubscriber(createNamedContext('test'), 'schema-key-1');
        let s2 = await repo.resolveSubscriber(createNamedContext('test'), 'schema-key-1');
        let s3 = await repo.resolveSubscriber(createNamedContext('test'), 'schema-key-2');
        expect(s1.id).toEqual(s2.id);
        expect(s1.key).toEqual(s2.key);
        expect(s1.id).not.toEqual(s3.id);
        expect(s1.key).not.toEqual(s3.key);
    });

    it('should resolve topics', async () => {
        let repo = container.get(FeedRepository);
        let s1 = await repo.resolveTopic(createNamedContext('test'), 'schema-topic-1');
        let s2 = await repo.resolveTopic(createNamedContext('test'), 'schema-topic-1');
        let s3 = await repo.resolveTopic(createNamedContext('test'), 'schema-topic-2');
        expect(s1.id).toEqual(s2.id);
        expect(s1.key).toEqual(s2.key);
        expect(s1.id).not.toEqual(s3.id);
        expect(s1.key).not.toEqual(s3.key);
    });

    it('should create events', async () => {
        let repo = container.get(FeedRepository);
        let res = await repo.createEvent(createNamedContext('test'), 'some-topic', 'test', { message: 'hello' });
        let topic = await repo.resolveTopic(createNamedContext('test'), 'some-topic');
        expect(res.type).toEqual('test');
        expect(res.tid).toEqual(topic.id);
        expect(res.content.message).toEqual('hello');
    });

    it('should subscribe and unsubscribe', async () => {
        let repo = container.get(FeedRepository);
        let t = await repo.resolveTopic(createNamedContext('test'), 'schema-topic-8');
        let subs = await repo.findSubscriptions(createNamedContext('test'), 'sub-key-1');
        for (let s of subs) {
            expect(s).not.toBe(t.id);
        }
        await repo.subscribe(createNamedContext('test'), 'sub-key-1', 'schema-topic-8');
        subs = await repo.findSubscriptions(createNamedContext('test'), 'sub-key-1');
        let exists = false;
        for (let s of subs) {
            if (s === t.id) {
                exists = true;
                break;
            }
        }
        expect(exists).toBeTruthy();

        await repo.unsubscribe(createNamedContext('test'), 'sub-key-1', 'schema-topic-8');
        subs = await repo.findSubscriptions(createNamedContext('test'), 'sub-key-1');
        for (let s of subs) {
            expect(s).not.toBe(t.id);
        }
    });

    it('should subscribe to self on subscriber creation', async () => {
        let repo = container.get(FeedRepository);
        await repo.resolveSubscriber(createNamedContext('test'), 'schema-key-3');
        let t1 = await repo.resolveTopic(createNamedContext('test'), 'schema-key-3');
        let subs = (await repo.findSubscriptions(createNamedContext('test'), 'schema-key-3'));
        expect(subs.indexOf(t1.id) > -1).toBeTruthy();
    });
});