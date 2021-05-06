import { Stream } from '@openland/foundationdb-entity';

import { Context } from '@openland/context';
import { withoutTransaction } from '@openland/foundationdb';
import { BusSubcription } from '@openland/foundationdb-bus';
import { delayBreakable, onContextCancel } from '@openland/lifetime';

export interface LiveStreamBatch {
    from: string | null;
    to: string;
}

export class FastLiveStream<T> {
    private readonly baseStream: Stream<T>;
    private ended = false;
    private awaiter?: () => void;
    private subscription?: BusSubcription;

    constructor(stream: Stream<T>) {
        this.baseStream = stream;

        this.subscription = stream.entityStorage.eventBus.subscibe(stream.eventBusKey, () => {
            if (this.awaiter) {
                this.awaiter();
                this.awaiter = undefined;
            }
        });
    }

    async * generator(parent: Context): AsyncIterable<LiveStreamBatch> {
        let t = this;
        let ctx = withoutTransaction(parent); // Clear transaction information since live stream manage transactions by itself
        onContextCancel(ctx, () => this.ended = true);
        try {
            if (!t.baseStream.cursor) {
                let tail = await this.baseStream.entityStorage.db.microtasks.execute((c) => t.baseStream.tail(c));
                if (tail) {
                    t.baseStream.seek(tail);
                }
            }
            while (!t.ended) {
                let start = t.baseStream.cursor;
                let res = await this.baseStream.entityStorage.db.microtasks.execute((c) => t.baseStream.next(c));
                if (res.length > 0) {
                    yield { from: start, to: t.baseStream.cursor! };
                } else {
                    if (t.ended) {
                        return;
                    }
                    let w = delayBreakable(ctx, 10000 + Math.random() * 15000);
                    t.awaiter = w.cancel;
                    await w.wait;
                    t.awaiter = undefined;
                }
            }
        } finally {
            t.handleEnded();
        }
    }

    private handleEnded() {
        this.ended = true;
        if (this.subscription) {
            this.subscription.cancel();
            this.subscription = undefined;
        }
    }
}