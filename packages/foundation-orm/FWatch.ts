import { FConnection } from './FConnection';
import { FKeyEncoding } from './utils/FKeyEncoding';
import { delay } from '../openland-utils/timer';
import { fastDeepEquals } from '../openland-utils/fastDeepEquals';
import { createLogger } from 'openland-log/createLogger';
import { Context, createNamedContext } from '@openland/context';

type Key = (string | number)[];
type ChangeCallback = () => void;

interface WatchOptions {
    onEnd(): void;
}

interface FWatchSubscription {
    cb: ChangeCallback;
    onEnd?(e: any): void;
}

const log = createLogger('fdb');

export class FWatch {
    public static POOL_TIMEOUT = 100;

    private subscriptions = new Map<Buffer, FWatchSubscription[]>();
    private ctx = createNamedContext('watch');

    constructor(
        private connection: FConnection
    ) {

    }

    public watch(ctx: Context, key: Key, cb: ChangeCallback, options?: WatchOptions): { cancel: () => void } {
        let encodedKey = FKeyEncoding.encodeKey(key);
        let subscription: FWatchSubscription = {
            cb,
            ...options
        };

        if (this.subscriptions.has(encodedKey)) {
            this.subscriptions.get(encodedKey)!.push(subscription);
        } else {
            this.subscriptions.set(encodedKey, [subscription]);
            // tslint:disable-next-line:no-floating-promises
            this.startWatching(encodedKey);
        }

        return {
            cancel: () => this.cancelSubscription(encodedKey, cb)
        };
    }

    private async startWatching(key: Buffer) {
        try {
            await this.doWatch(key);
        } catch (e) {
            log.warn(this.ctx, e);
            // fallback to polling
            try {
                log.debug(this.ctx, 'fallback to pooling');
                await this.doPolling(key);
            } catch (e) {
                log.debug(this.ctx, 'something happend');
                log.warn(this.ctx, e);
                // notify subscribers about end
                let subs = this.subscriptions.get(key);
                if (subs && subs.length > 0) {
                    [...subs].forEach(s => s.onEnd && s.onEnd(e));
                }
                this.subscriptions.delete(key);
            }
        }
    }

    private async doPolling(key: Buffer) {
        let value = await this.connection.fdb.get(key);

        while (true) {
            let newValue = await this.connection.fdb.get(key);
            if (!fastDeepEquals(newValue, value)) {
                if (!this.sendNotifications(key)) {
                    this.subscriptions.delete(key);
                    return;
                }

                value = newValue;
            }
            await delay(FWatch.POOL_TIMEOUT);
        }
    }

    private async doWatch(key: Buffer) {
        while (true) {
            let subscription = await this.connection.fdb.getAndWatch(key);
            log.debug(this.ctx, 'subscribe');

            let res = await subscription.promise;

            if (!res) {
                throw new Error('FWatch error');
            }

            if (!this.sendNotifications(key)) {
                this.subscriptions.delete(key);
                subscription.cancel();
                return;
            }
        }
    }

    private sendNotifications(key: Buffer) {
        let subs = this.subscriptions.get(key);
        if (subs && subs.length > 0) {
            // we need to copy subs here because original array changes while iteration causes some bugs
            [...subs].forEach(s => s.cb());
            return true;
        }
        return false;
    }

    private cancelSubscription(key: Buffer, cb: ChangeCallback) {
        if (!this.subscriptions.get(key)) {
            throw new Error('FWatch inconsistency');
        } else {
            let subs = this.subscriptions.get(key)!;
            let index = subs.findIndex(s => s.cb === cb);

            if (index === -1) {
                throw new Error('FWatch double unwatch');
            } else {
                subs.splice(index, 1);
            }
        }
    }
}