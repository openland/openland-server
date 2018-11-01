import { FStream } from './FStream';
import { FEntity } from './FEntity';
import { delayBreakable } from 'openland-server/utils/timer';
import { FLiveStreamItem } from './FLiveStreamItem';
import { FPubsubSubcription } from './FPubsub';

export class FLiveStream<T extends FEntity> {
    private readonly baseStream: FStream<T>;
    private ended = false;
    private awaiter?: () => void;
    private subscription?: FPubsubSubcription;

    constructor(stream: FStream<T>) {
        this.baseStream = stream;

        this.subscription = stream.factory.connection.pubsub.subscribe('fdb-entity-created', (data: any) => {
            console.log('pubsubreceived');
            if (data.entity === stream.factory.name) {
                if (this.awaiter) {
                    this.awaiter();
                    this.awaiter = undefined;
                }
            }
        });
    }

    generator(): AsyncIterator<FLiveStreamItem<T>> {
        let t = this;
        return {
            ...(async function* func(): AsyncIterator<FLiveStreamItem<T>> {
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
                        let w = delayBreakable(1000);
                        t.awaiter = w.resolver;
                        await w.resolver();
                        t.awaiter = undefined;
                    }
                }
            })(),
            return: async () => {
                this.handleEnded();
                return { done: true, value: { items: [], cursor: t.baseStream.cursor } };
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