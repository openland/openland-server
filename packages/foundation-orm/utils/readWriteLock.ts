import { Mutex } from './mutex';
import { Context } from 'openland-utils/Context';
import { createTracer } from 'openland-log/createTracer';

const tracer = createTracer('rwlock');

export class ReadWriteLock {
    private readOperations = 0;
    private readLock = new Mutex();
    private writeLock = new Mutex();

    runReadOperation = async <T>(ctx: Context, fn: () => Promise<T>) => {
        if (!this.readLock.isLocked) {
            this.readLock.acquireSync();
        } else {
            await tracer.trace(ctx, 'read-lock', async () => {
                await this.readLock.acquire();
            });
        }
        this.readOperations++;
        if (this.readOperations === 1) {
            if (!this.writeLock.isLocked) {
                this.writeLock.acquireSync();
            } else {
                await tracer.trace(ctx, 'write-lock', async () => {
                    await this.writeLock.acquire();
                });
            }
        }
        this.readLock.release();
        try {
            return await fn();
        } finally {
            if (!this.readLock.isLocked) {
                this.readLock.acquireSync();
            } else {
                await tracer.trace(ctx, 'read-lock', async () => {
                    await this.readLock.acquire();
                });
            }
            this.readOperations--;
            if (this.readOperations === 0) {
                this.writeLock.release();
            }
            this.readLock.release();
        }
    }
    runWriteOperation = async <T>(ctx: Context, fn: () => Promise<T>) => {
        if (!this.writeLock.isLocked) {
            this.writeLock.acquireSync();
        } else {
            await tracer.trace(ctx, 'write-lock', async () => {
                await this.writeLock.acquire();
            });
        }
        try {
            return await fn();
        } finally {
            this.writeLock.release();
        }
    }
}