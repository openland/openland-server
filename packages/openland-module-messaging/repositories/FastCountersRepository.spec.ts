import { testEnvironmentEnd, testEnvironmentStart } from '../../openland-modules/testEnvironment';
import { container } from '../../openland-modules/Modules.container';
import { UsersModule } from '../../openland-module-users/UsersModule';
import { loadUsersModule } from '../../openland-module-users/UsersModule.container';
import { FastCountersRepository } from './FastCountersRepository';
import { createNamedContext } from '@openland/context';
import { inTx } from '@openland/foundationdb';
import { Store } from '../../openland-module-db/FDB';

let parentCtx = createNamedContext('test');

describe('FastCountersRepository', () => {
    beforeAll(async () => {
        await testEnvironmentStart('fat-counters-repo');
        container.bind('FastCountersRepository').to(FastCountersRepository).inSingletonScope();
        container.bind(UsersModule).toSelf().inSingletonScope();
        loadUsersModule();
    });
    afterAll( async () => {
        await  testEnvironmentEnd();
    });

    it('counter should be 0 for new chat', async () => {
        let repo = container.get<FastCountersRepository>('FastCountersRepository');
        await inTx(parentCtx, async ctx => {
            await repo.onAddDialog(ctx, 1, 1);

            let counters = await repo.fetchUserCounters(ctx, 1);
            expect(counters.length).toBe(1);
            expect(counters[0].haveMention).toBe(false);
            expect(counters[0].unreadCounter).toBe(0);
        });
    });

    it('should handle dialog deletion', async () => {
        let repo = container.get<FastCountersRepository>('FastCountersRepository');
        await inTx(parentCtx, async ctx => {
            await repo.onAddDialog(ctx, 2, 1);

            let counters = await repo.fetchUserCounters(ctx, 2);
            expect(counters.length).toBe(1);
            expect(counters[0].haveMention).toBe(false);
            expect(counters[0].unreadCounter).toBe(0);

            await repo.onRemoveDialog(ctx, 2, 1);

            counters = await repo.fetchUserCounters(ctx, 2);
            expect(counters.length).toBe(0);
        });
    });

    it('should calc unreads', async () => {
        let repo = container.get<FastCountersRepository>('FastCountersRepository');
        await inTx(parentCtx, async ctx => {
            let uid = 3;
            let cid = 2;

            await repo.onAddDialog(ctx, uid, cid);
            await Store.ConversationLastSeq.byId(cid).set(ctx, 100);

            let counters = await repo.fetchUserCounters(ctx, uid);
            expect(counters.length).toBe(1);
            expect(counters[0].haveMention).toBe(false);
            expect(counters[0].unreadCounter).toBe(100);
        });
    });

    it('should handle message read', async () => {
        let repo = container.get<FastCountersRepository>('FastCountersRepository');
        await inTx(parentCtx, async ctx => {
            let uid = 4;
            let cid = 3;

            await repo.onAddDialog(ctx, uid, cid);
            await Store.ConversationLastSeq.byId(cid).set(ctx, 100);

            let counters = await repo.fetchUserCounters(ctx, uid);
            expect(counters.length).toBe(1);
            expect(counters[0].haveMention).toBe(false);
            expect(counters[0].unreadCounter).toBe(100);

            repo.onMessageRead(ctx, uid, cid, 100);

            counters = await repo.fetchUserCounters(ctx, uid);
            expect(counters.length).toBe(1);
            expect(counters[0].haveMention).toBe(false);
            expect(counters[0].unreadCounter).toBe(0);
        });
    });

    it('should handle deleted messages', async () => {
        let repo = container.get<FastCountersRepository>('FastCountersRepository');
        let uid = 5;
        let cid = 4;

        await inTx(parentCtx, async ctx => {
            await repo.onAddDialog(ctx, uid, cid);
            await Store.ConversationLastSeq.byId(cid).set(ctx, 100);

            await repo.onMessageDeleted(ctx, cid, 1, [], []);
            await repo.onMessageDeleted(ctx, cid, 2, [], []);
            await repo.onMessageDeleted(ctx, cid, 3, [], []);
            await repo.onMessageDeleted(ctx, cid, 4, [], []);
            await repo.onMessageDeleted(ctx, cid, 5, [], []);

            let counters = await repo.fetchUserCounters(ctx, uid);
            expect(counters.length).toBe(1);
            expect(counters[0].haveMention).toBe(false);
            expect(counters[0].unreadCounter).toBe(95);
        });

        // jump to other bucket
        await inTx(parentCtx, async ctx => await Store.ConversationLastSeq.byId(cid).set(ctx, 3000));

        let _counters = await inTx(parentCtx, async _ctx => await repo.fetchUserCounters(_ctx, uid));
        expect(_counters.length).toBe(1);
        expect(_counters[0].haveMention).toBe(false);
        expect(_counters[0].unreadCounter).toBe(2995);
    });

    it('should handle user mention', async () => {
        let repo = container.get<FastCountersRepository>('FastCountersRepository');
        await inTx(parentCtx, async ctx => {
            let uid = 6;
            let cid = 5;

            await repo.onAddDialog(ctx, uid, cid);
            await Store.ConversationLastSeq.byId(cid).set(ctx, 100);

            await repo.onMessageCreated(ctx, 10, cid, 1, [uid], []);

            let counters = await repo.fetchUserCounters(ctx, uid);
            expect(counters.length).toBe(1);
            expect(counters[0].haveMention).toBe(true);
            expect(counters[0].unreadCounter).toBe(100);
        });
    });

    it('should handle deletion of mention', async () => {
        let repo = container.get<FastCountersRepository>('FastCountersRepository');
        await inTx(parentCtx, async ctx => {
            let uid = 7;
            let cid = 6;

            await repo.onAddDialog(ctx, uid, cid);
            await Store.ConversationLastSeq.byId(cid).set(ctx, 100);

            await repo.onMessageCreated(ctx, 10, cid, 1, [uid], []);

            let counters = await repo.fetchUserCounters(ctx, uid);
            expect(counters.length).toBe(1);
            expect(counters[0].haveMention).toBe(true);
            expect(counters[0].unreadCounter).toBe(100);

            await repo.onMessageDeleted(ctx, cid, 1, [uid], []);

            counters = await repo.fetchUserCounters(ctx, uid);
            expect(counters.length).toBe(1);
            expect(counters[0].haveMention).toBe(false);
            expect(counters[0].unreadCounter).toBe(99);
        });
    });

    it('should handle deletion of mention after message edit', async () => {
        let repo = container.get<FastCountersRepository>('FastCountersRepository');
        await inTx(parentCtx, async ctx => {
            let uid = 8;
            let cid = 7;

            await repo.onAddDialog(ctx, uid, cid);
            await Store.ConversationLastSeq.byId(cid).set(ctx, 100);

            await repo.onMessageCreated(ctx, 10, cid, 1, [uid], []);

            let counters = await repo.fetchUserCounters(ctx, uid);
            expect(counters.length).toBe(1);
            expect(counters[0].haveMention).toBe(true);
            expect(counters[0].unreadCounter).toBe(100);

            await repo.onMessageEdited(ctx, cid, 1, [uid], []);

            counters = await repo.fetchUserCounters(ctx, uid);
            expect(counters.length).toBe(1);
            expect(counters[0].haveMention).toBe(false);
            expect(counters[0].unreadCounter).toBe(100);
        });
    });

    it('should handle creation of mention after message edit', async () => {
        let repo = container.get<FastCountersRepository>('FastCountersRepository');
        await inTx(parentCtx, async ctx => {
            let uid = 9;
            let cid = 8;

            await repo.onAddDialog(ctx, uid, cid);
            await Store.ConversationLastSeq.byId(cid).set(ctx, 100);

            await repo.onMessageCreated(ctx, 10, cid, 1, [], []);

            let counters = await repo.fetchUserCounters(ctx, uid);
            expect(counters.length).toBe(1);
            expect(counters[0].haveMention).toBe(false);
            expect(counters[0].unreadCounter).toBe(100);

            await repo.onMessageEdited(ctx, cid, 1, [], [uid]);

            counters = await repo.fetchUserCounters(ctx, uid);
            expect(counters.length).toBe(1);
            expect(counters[0].haveMention).toBe(true);
            expect(counters[0].unreadCounter).toBe(100);
        });
    });
});