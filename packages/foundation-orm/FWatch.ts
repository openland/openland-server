import { FConnection } from './FConnection';
import { FKeyEncoding } from './utils/FKeyEncoding';
import { FKeyType } from './FKeyType';

type ChangeCallback = () => void;

export class FWatch {
    private subscriptions = new Map<string, ChangeCallback[]>();

    constructor(
        private connection: FConnection
    ) {

    }

    public watch(key: FKeyType, cb: ChangeCallback): { cancel: () => void } {
        let keyStr = key.join('.');

        if (this.subscriptions.has(keyStr)) {
            this.subscriptions.get(keyStr)!.push(cb);
        } else {
            this.subscriptions.set(keyStr, [cb]);
            // tslint:disable-next-line:no-floating-promises
            this.startWatch(key);
        }

        return {
            cancel: () => {
                if (!this.subscriptions.get(keyStr)) {
                    throw new Error('FWatch inconsistency');
                } else {
                    let subs = this.subscriptions.get(keyStr)!;
                    let index = subs.indexOf(cb);

                    if (index === -1) {
                        throw new Error('FWatch double unwatch');
                    } else {
                        subs.splice(index, 1);
                    }
                }
            }
        };
    }

    private async startWatch(key: FKeyType) {
        let subscription = await this.connection.fdb.getAndWatch(FKeyEncoding.encodeKey(key));

        let res = await subscription.promise;

        if (!res) {
            throw new Error('FWatch error');
        }

        let keyStr = key.join('.');
        let subs = this.subscriptions.get(keyStr);

        if (!subs || subs.length === 0) {
            this.subscriptions.delete(keyStr);
            subscription.cancel();
        } else {
            // we need to copy subs here because original array changes while iteration causes some bugs
            [...subs].forEach(s => s());
            // tslint:disable-next-line:no-floating-promises
            this.startWatch(key);
        }
    }
}