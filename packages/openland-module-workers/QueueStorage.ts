import { createNamedContext, Context } from '@openland/context';
import { EntityStorage } from '@openland/foundationdb-entity';
import { inTx, encoders, Subspace, Database } from '@openland/foundationdb';
import { WorkQueueRepository } from './repo/WorkQueueRepository';

export class QueueStorage {

    static async open(name: string, storage: EntityStorage) {
        let resolved = await inTx(createNamedContext('entity'), async (ctx) => {

            // Map id
            let registryDirectory = (await storage.db.directories.createOrOpen(ctx, ['com.openland.tasks', 'registry']))
                .withKeyEncoding(encoders.tuple)
                .withValueEncoding(encoders.int32LE);
            let id: number;
            let existing = await registryDirectory.get(ctx, [name]);
            if (!existing) {
                let lastCounter = (await registryDirectory.get(ctx, [])) || 0;
                let newValue = lastCounter++;
                registryDirectory.set(ctx, [], newValue);
                registryDirectory.set(ctx, [name], newValue);
                id = newValue;
            } else {
                id = existing;
            }

            // Tasks directory
            let tasksDirectory = (await storage.db.directories.createOrOpen(ctx, ['com.openland.tasks', 'tasks']));

            return {
                id,
                subspace: tasksDirectory
            };
        });
        return new QueueStorage(name, resolved.id, resolved.subspace);
    }

    readonly name: string;
    readonly kind: number;
    readonly db: Database;

    private readonly repo: WorkQueueRepository;

    constructor(name: string, kind: number, subspace: Subspace) {
        this.name = name;
        this.kind = kind;
        this.db = subspace.db;
        this.repo = new WorkQueueRepository(subspace);
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

    pushWork = (ctx: Context, args: any, maxAttempts: number | 'infinite') => {
        this.repo.pushWork(ctx, this.kind, args, maxAttempts);
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