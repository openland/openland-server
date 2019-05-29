import { Mutex } from './mutex';

export class ReadWriteLock {
    private readOperations = 0;
    private readLock = new Mutex();
    private writeLock = new Mutex();

    runReadOperation = async <T>(fn: () => Promise<T>) => {
        if (!this.readLock.isLocked) {
            this.readLock.acquireSync();
        } else {
            await this.readLock.acquire();
        }
        this.readOperations++;
        if (this.readOperations === 1) {
            if (!this.writeLock.isLocked) {
                this.writeLock.acquireSync();
            } else {
                await this.writeLock.acquire();
            }
        }
        this.readLock.release();
        try {
            return await fn();
        } finally {
            if (!this.readLock.isLocked) {
                this.readLock.acquireSync();
            } else {
                await this.readLock.acquire();
            }
            this.readOperations--;
            if (this.readOperations === 0) {
                this.writeLock.release();
            }
            this.readLock.release();
        }
    }
    runWriteOperation = async <T>(fn: () => Promise<T>) => {
        if (!this.writeLock.isLocked) {
            this.writeLock.acquireSync();
        } else {
            await this.writeLock.acquire();
        }
        try {
            return await fn();
        } finally {
            this.writeLock.release();
        }
    }
}