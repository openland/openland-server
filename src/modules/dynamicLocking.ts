import * as Crypto from 'crypto';
import { delay, AsyncLock } from '../utils/timer';

export interface LockProvider {
    lock(seed: string, timeout: number): Promise<boolean>;
    refresh(seed: string, timeout: number): Promise<boolean>;
    unlock(seed: string): Promise<boolean>;
}

export interface LockState {
    check(): void;
    isAlive(): boolean;
}

export class DynamicLock {
    private refreshInterval: number;
    private lockTimeout: number;
    constructor(opts: {
        refreshInterval: number,
        lockTimeout: number,
    }) {
        this.refreshInterval = opts.refreshInterval;
        this.lockTimeout = opts.lockTimeout;
    }

    within = async (provider: LockProvider, work: (state: LockState) => any): Promise<boolean> => {
        let lockSeed = Crypto.randomBytes(32).toString('hex');
        var isRunning = false;
        var asyncLock = new AsyncLock();
        class State implements LockState {
            check() {
                if (!isAlive) {
                    throw new Error('Lock is not alive');
                }
            }
            isAlive() {
                return isAlive;
            }
        }
        let state = new State();
        let refresher = async () => {
            await delay(this.refreshInterval);
            while (isRunning) {
                if (!await asyncLock.inLock(async () => await provider.refresh(lockSeed, Date.now() + this.lockTimeout))) {
                    isAlive = false;
                    break;
                }
                await delay(this.refreshInterval);
            }
        };
        try {
            // Initial Locking
            var isAlive = await provider.lock(lockSeed, Date.now() + this.lockTimeout);

            // Exit on failure or unsuccessful locking
            if (!isAlive) {
                return false;
            }

            isRunning = true;

            // Starting refresher
            refresher();

            // Doing work
            await work(state);

            isRunning = false;

            // Exiting
            return isAlive;
        } catch (e) {
            isAlive = false;
            isRunning = false;
            console.warn(e);
            return false;
        } finally {
            isRunning = false;
            if (!await asyncLock.inLock(async () => await provider.unlock(lockSeed))) {
                return false;
            }
        }
    }
}