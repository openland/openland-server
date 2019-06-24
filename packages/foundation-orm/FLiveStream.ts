import { FStream } from './FStream';
import { FEntity } from './FEntity';
import { delayBreakable } from 'openland-utils/timer';
import { FLiveStreamItem } from './FLiveStreamItem';
import { Context } from '@openland/context';
import { withoutTransaction } from '@openland/foundationdb';
import { BusSubcription } from '@openland/foundationdb-bus';

export class FLiveStream<T extends FEntity> {
    private readonly baseStream: FStream<T>;
    private ended = false;
    private awaiter?: () => void;
    private subscription?: BusSubcription;

    constructor(stream: FStream<T>) {
        this.baseStream = stream;

        this.subscription = stream.factory.layer.eventBus.subscibe('fdb-entity-created-' + this.baseStream.factory.name, (data: any) => {
            if (data.entity === stream.factory.name) {
                if (this.awaiter) {
                    this.awaiter();
                    this.awaiter = undefined;
                }
            }
        });
    }

    generator(parent: Context): AsyncIterable<FLiveStreamItem<T>> {
        let t = this;
        let ctx = withoutTransaction(parent); // Clear transaction information since live stream manage transactions by itself
        return {
            [Symbol.asyncIterator]() {
                return {
                    ...(async function* func() {
                        if (!t.baseStream.cursor) {
                            let tail = await t.baseStream.tail(ctx);
                            if (tail) {
                                t.baseStream.seek(tail);
                            }
                        }
                        while (!t.ended) {
                            let res = await t.baseStream.next(ctx);
                            if (res.length > 0) {
                                yield { items: res, cursor: t.baseStream.cursor };
                            } else {
                                let w = delayBreakable(10000 + Math.random() * 15000);
                                t.awaiter = w.resolver;
                                await w.promise;
                                t.awaiter = undefined;
                            }
                        }
                    })(),
                    return: async () => {
                        t.handleEnded();
                        return { done: true, value: { items: [], cursor: t.baseStream.cursor } };
                    }
                };
            }
        };
    }

    private handleEnded() {
        this.ended = true;
        if (this.subscription) {
            this.subscription.cancel();
            this.subscription = undefined;
        }
    }
}