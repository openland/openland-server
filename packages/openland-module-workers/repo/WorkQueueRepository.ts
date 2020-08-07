import uuid from 'uuid/v4';
import { Context } from '@openland/context';
import { Subspace, encoders, getTransaction, TransactionCache, TupleItem, Database, inTx } from '@openland/foundationdb';

const PREFIX_PENDING = Buffer.from([0x01]);
const PREFIX_ACTIVE = Buffer.from([0x02]);
const PREFIX_TIMEOUTS = Buffer.from([0x03]);
const PREFIX_ARGUMENTS = Buffer.from([0x04]);
const PREFIX_FAILURES = Buffer.from([0x05]);
const PREFIX_STATS = Buffer.from([0x06]);
const ZERO = Buffer.alloc(0);
const STATS_TOTAL = 0;
const STATS_ACTIVE = 1;
const STATS_FAILURES = 2;
const STATS_COMPLETED = 3;

const workIndexCache = new TransactionCache<number>('work-queue-cache');

export class WorkQueueRepository {

    static async open(parent: Context, db: Database) {
        let dirs = await inTx(parent, async (ctx) => {
            let registryDirectory = (await db.directories.createOrOpen(ctx, ['com.openland.tasks', 'registry']));
            let tasksDirectory = (await db.directories.createOrOpen(ctx, ['com.openland.tasks', 'tasks']));
            return { registryDirectory, tasksDirectory };
        });
        return new WorkQueueRepository(db, dirs.tasksDirectory, dirs.registryDirectory);
    }

    readonly db: Database;
    private readonly tasksSubspace: Subspace;
    private readonly registrySubspace: Subspace<TupleItem[], number>;
    private readonly argumentsSubspace: Subspace;
    private readonly pendingSubspace: Subspace;
    private readonly activeSubspace: Subspace;
    private readonly timeoutSubspace: Subspace;
    private readonly failuresSubspace: Subspace;
    private readonly statsSubspace: Subspace<TupleItem[], number>;

    constructor(db: Database, tasksSubspace: Subspace, registrySubspace: Subspace) {
        this.db = db;
        this.tasksSubspace = tasksSubspace;
        this.registrySubspace = registrySubspace
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.int32LE);
        this.pendingSubspace = this.tasksSubspace
            .subspace(encoders.tuple.pack([PREFIX_PENDING]));
        this.activeSubspace = this.tasksSubspace
            .subspace(encoders.tuple.pack([PREFIX_ACTIVE]));
        this.timeoutSubspace = this.tasksSubspace
            .subspace(encoders.tuple.pack([PREFIX_TIMEOUTS]));
        this.argumentsSubspace = this.tasksSubspace
            .subspace(encoders.tuple.pack([PREFIX_ARGUMENTS]));
        this.failuresSubspace = this.tasksSubspace
            .subspace(encoders.tuple.pack([PREFIX_FAILURES]));
        this.statsSubspace = this.tasksSubspace
            .subspace(encoders.tuple.pack([PREFIX_STATS]))
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.int32LE);
    }

    getTotal = async (ctx: Context, kind: number) => {
        return (await this.statsSubspace.get(ctx, [STATS_TOTAL, kind])) || 0;
    }

    getActive = async (ctx: Context, kind: number) => {
        return (await this.statsSubspace.get(ctx, [STATS_ACTIVE, kind])) || 0;
    }

    getCompleted = async (ctx: Context, kind: number) => {
        return (await this.statsSubspace.get(ctx, [STATS_COMPLETED, kind])) || 0;
    }

    getFailures = async (ctx: Context, kind: number) => {
        return (await this.statsSubspace.get(ctx, [STATS_FAILURES, kind])) || 0;
    }

    resolveQueueId = async (parent: Context, name: string) => {
        return await inTx(parent, async (ctx) => {
            let id: number;
            let existing = await this.registrySubspace.get(ctx, [name]);
            if (!existing) {
                let lastCounter = (await this.registrySubspace.get(ctx, [])) || 0;
                let newValue = ++lastCounter;
                this.registrySubspace.set(ctx, [], newValue);
                this.registrySubspace.set(ctx, [name], newValue);
                id = newValue;
            } else {
                id = existing;
            }
            return id;
        });
    }

    listQueues = async (ctx: Context) => {
        let allItems = await this.registrySubspace.range(ctx, []);
        let res: { name: string, id: number }[] = [];
        for (let q of allItems) {
            if (q.key.length === 0 || q.value === 0) {
                continue;
            }
            res.push({ name: q.key[0] as string, id: q.value });
        }
        return res;
    }

    pushWork = (ctx: Context, kind: number, args: any, maxAttempts: number | 'infinite') => {

        // Generate ID
        let id = Buffer.alloc(16);
        uuid(undefined, id);

        // Index of work item in the transaction
        let ex = (workIndexCache.get(ctx, 'key') || 0) + 1;
        workIndexCache.set(ctx, 'key', ex);

        // Pack arguments
        let argsBuff = encoders.json.pack(args);

        // Save to pending list
        this.pendingSubspace.setVersionstampedKey(ctx, encoders.tuple.pack([kind]), id, encoders.tuple.pack([ex]));

        // Save arguments
        this.argumentsSubspace.set(ctx, id, argsBuff);

        // Save attempts
        if (typeof maxAttempts === 'string') {
            if (maxAttempts !== 'infinite') {
                throw Error('Invalid maxAttempts argument');
            }
        } else if (typeof maxAttempts === 'number') {
            if (maxAttempts <= 0 || maxAttempts > 50) {
                throw Error('Invalid maxAttempts argument');
            } else if (!Number.isSafeInteger(maxAttempts)) {
                throw Error('Invalid maxAttempts argument');
            }
        } else {
            throw Error('Invalid maxAttempts argument');
        }
        this.failuresSubspace.set(ctx, id, encoders.tuple.pack([maxAttempts]));

        // Update counter
        this.statsSubspace.add(ctx, [STATS_TOTAL, kind], 1);
    }

    acquireWork = async (ctx: Context, kind: number, limit: number, lock: Buffer, timeout: number) => {

        let res: Buffer[] = [];

        let tx = getTransaction(ctx).rawTransaction(this.tasksSubspace.db);

        // Read required number of work items
        let read = await this.pendingSubspace.snapshotRange(ctx, encoders.tuple.pack([kind]), { limit: limit });

        // Lock all work
        for (let r of read) {

            // Prepare data
            let id = r.value;

            // Mark key as read conflict since we read all items from snapshot
            tx.addReadConflictKey(Buffer.concat([this.pendingSubspace.prefix, r.key]));

            // Remove from pending collection
            this.pendingSubspace.clear(ctx, r.key);

            // Add to active collection
            this.activeSubspace.set(ctx, id, encoders.tuple.pack([kind, lock, timeout]));

            // Save timeout
            this.timeoutSubspace.set(ctx, encoders.tuple.pack([timeout, id]), encoders.tuple.pack([kind]));

            // Increase counter
            this.statsSubspace.add(ctx, [STATS_ACTIVE, kind], 1);

            // Extract id and args
            res.push(id);
        }

        return res;
    }

    resolveTask = async (ctx: Context, id: Buffer, lock: Buffer) => {
        let active = await this.activeSubspace.get(ctx, id);
        if (!active) {
            // Ignore if there are no active task with this id
            return null;
        }

        // Check lock
        let exlock = (encoders.tuple.unpack(active))[1] as Buffer;
        if (exlock.compare(lock) !== 0) {
            return null;
        }

        // Read arguments
        let args = await this.argumentsSubspace.get(ctx, id);
        if (!args) {
            return null;
        }
        return encoders.json.unpack(args);
    }

    refreshLock = async (ctx: Context, id: Buffer, lock: Buffer, newTimeout: number) => {

        // Find active work
        let active = await this.activeSubspace.get(ctx, id);
        if (!active) {
            // Ignore if there are no active task with this id
            return false;
        }

        let activeRef = encoders.tuple.unpack(active);
        let kind = activeRef[0] as number;
        let exlock = activeRef[1] as Buffer;
        let timeout = activeRef[2] as number;

        // Check if lock changed
        if (exlock.compare(lock) !== 0) {
            return false;
        }

        // Check if tiemout increased
        if (newTimeout < timeout) {
            return true;
        }

        // Update timeout
        this.activeSubspace.set(ctx, id, encoders.tuple.pack([kind, exlock, newTimeout]));
        this.timeoutSubspace.clear(ctx, encoders.tuple.pack([timeout, id]));
        this.timeoutSubspace.set(ctx, encoders.tuple.pack([newTimeout, id]), encoders.tuple.pack([kind]));

        return true;
    }

    rescheduleTasks = async (ctx: Context, now: number) => {
        let tx = getTransaction(ctx).rawTransaction(this.tasksSubspace.db);
        let expired = await this.timeoutSubspace.snapshotRange(ctx, ZERO, { limit: 100, after: encoders.tuple.pack([now]), reverse: true });

        for (let exp of expired) {
            let key = encoders.tuple.unpack(exp.key);
            let id = key[1] as Buffer;
            let kind = encoders.tuple.unpack(exp.value)[0] as number;

            // Mark key as read conflict since we read all items from snapshot
            tx.addReadConflictKey(Buffer.concat([this.timeoutSubspace.prefix, exp.key]));

            // Remove from active
            this.activeSubspace.clear(ctx, id);

            // Remove from timeouts
            this.timeoutSubspace.clear(ctx, exp.key);

            // Resolve remaining attempts
            let attempts = await this.failuresSubspace.get(ctx, id);
            let maxAttempts: number | 'infinite' | null = null;
            if (attempts) {
                let parsed = encoders.tuple.unpack(attempts)[0];
                if (typeof parsed === 'string') {
                    if (parsed === 'infinite') {
                        maxAttempts = 'infinite';
                    }
                } else if (typeof parsed === 'number') {
                    if (parsed > 1 && parsed <= 50) {
                        maxAttempts = parsed - 1;
                    }
                }
            }

            // Update counters
            this.statsSubspace.add(ctx, [STATS_FAILURES, kind], 1);
            this.statsSubspace.add(ctx, [STATS_ACTIVE, kind], -1);

            // Cancel task if expired
            if (maxAttempts === null) {
                // Delete failures
                this.failuresSubspace.clear(ctx, id);

                // Delete arguments
                this.argumentsSubspace.clear(ctx, id);
            } else {

                // Update failures
                this.failuresSubspace.set(ctx, id, encoders.tuple.pack([maxAttempts]));

                // Add to pending
                // Index of work item in the transaction
                let ex = (workIndexCache.get(ctx, 'key') || 0) + 1;
                workIndexCache.set(ctx, 'key', ex);

                // Save to pending list
                this.pendingSubspace.setVersionstampedKey(ctx, encoders.tuple.pack([kind]), id, encoders.tuple.pack([ex]));
            }
        }

        return expired.length > 0;
    }

    completeWork = async (ctx: Context, id: Buffer) => {

        // Find active work
        let active = await this.activeSubspace.get(ctx, id);
        if (!active) {
            // Ignore if there are no active task with this id
            return;
        }
        let activeRef = encoders.tuple.unpack(active);
        let kind = activeRef[0] as number;
        let timeout = activeRef[2] as number;

        // Delete active
        this.activeSubspace.clear(ctx, id);

        // Delete arguments
        this.argumentsSubspace.clear(ctx, id);

        // Delete remaining failures
        this.failuresSubspace.clear(ctx, id);

        // Delete timeout
        this.timeoutSubspace.clear(ctx, encoders.tuple.pack([timeout, id]));

        // Update counter
        this.statsSubspace.add(ctx, [STATS_ACTIVE, kind], -1);
        this.statsSubspace.add(ctx, [STATS_COMPLETED, kind], 1);
    }
}