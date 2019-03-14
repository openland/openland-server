import { FStream } from './FStream';
import { FEntity } from './FEntity';
import { delayBreakable } from 'openland-utils/timer';
import { FLiveStreamItem } from './FLiveStreamItem';
import { FPubsubSubcription } from './FPubsub';

export class FLiveStream<T extends FEntity> {
    private readonly baseStream: FStream<T>;
    private ended = false;
    private awaiter?: () => void;
    private subscription?: FPubsubSubcription;

    constructor(stream: FStream<T>) {
        this.baseStream = stream;

        this.subscription = stream.factory.connection.pubsub.subscribe('fdb-entity-created-' + this.baseStream.factory.name, (data: any) => {
            if (data.entity === stream.factory.name) {
                if (this.awaiter) {
                    this.awaiter();
                    this.awaiter = undefined;
                }
            }
        });
    }

    generator(): AsyncIterable<FLiveStreamItem<T>> {
        let t = this;
        return {
            [Symbol.asyncIterator]() {
                return {
                    ...(async function* func() {
                        if (!t.baseStream.cursor) {
                            let tail = await t.baseStream.tail();
                            if (tail) {
                                t.baseStream.seek(tail);
                            }
                        }
                        while (!t.ended) {
                            let res = await t.baseStream.next();
                            if (res.length > 0) {
                                yield { items: res, cursor: t.baseStream.cursor };
                            } else {
                                let w = delayBreakable(1000 + Math.random() * 5000);
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