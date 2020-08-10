import { createNamedContext, Context } from '@openland/context';
import { EntityStorage } from '@openland/foundationdb-entity';
import { inTx, Database } from '@openland/foundationdb';
import { WorkQueueRepository } from './repo/WorkQueueRepository';

export class QueueStorage {

    static async open(name: string, storage: EntityStorage) {
        let resolved = await inTx(createNamedContext('entity'), async (ctx) => {
            let repo = await WorkQueueRepository.open(ctx, storage.db);
            let id = await repo.resolveQueueId(ctx, name);
            return {
                id,
                repo
            };
        });
        return new QueueStorage(name, resolved.id, resolved.repo);
    }

    readonly name: string;
    readonly kind: number;
    readonly db: Database;

    private readonly repo: WorkQueueRepository;

    constructor(name: string, kind: number, repo: WorkQueueRepository) {
        this.name = name;
        this.kind = kind;
        this.db = repo.db;
        this.repo = repo;
    }

    getActive = (ctx: Context) => {
        return this.repo.getActive(ctx, this.kind);
    }

    getFailures = (ctx: Context) => {
        return this.repo.getFailures(ctx, this.kind);
    }

    getTotal = (ctx: Context) => {
        return this.repo.getTotal(ctx, this.kind);
    }

    getCompleted = (ctx: Context) => {
        return this.repo.getCompleted(ctx, this.kind);
    }

    getScheduled = (ctx: Context) => {
        return this.repo.getScheduled(ctx, this.kind);
    }

    pushWork = (ctx: Context, args: any, maxAttempts: number | 'infinite', startAt?: number) => {
        this.repo.pushWork(ctx, this.kind, args, maxAttempts, startAt);
    }

    acquireWork = async (ctx: Context, limit: number, lock: Buffer, timeout: number) => {
        return await this.repo.acquireWork(ctx, this.kind, limit, lock, Date.now() + timeout);
    }

    refreshLock = async (ctx: Context, id: Buffer, lock: Buffer, timeout: number) => {
        return await this.repo.refreshLock(ctx, id, lock, Date.now() + timeout);
    }

    resolveTask = async (ctx: Context, id: Buffer, lock: Buffer) => {
        return await this.repo.resolveTask(ctx, id, lock);
    }

    completeWork = async (ctx: Context, id: Buffer) => {
        await this.repo.completeWork(ctx, id);
    }
}