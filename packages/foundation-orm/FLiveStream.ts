import { FStream } from './FStream';
import { FEntity } from './FEntity';
import { delay } from 'openland-server/utils/timer';

export class FLiveStream<T extends FEntity> {
    private readonly baseStream: FStream<T>;

    constructor(stream: FStream<T>) {
        this.baseStream = stream;
    }

    async * generator() {
        let ended = false;
        let baseStream = this.baseStream;
        return {
            ...(async function* func(): AsyncIterator<{ items: T[], cursor: string }> {
                while (!ended) {
                    let res = await baseStream.next();
                    if (res.length > 0) {
                        yield { items: res, cursor: baseStream.cursor };
                    } else {
                        await delay(1000);
                    }
                }
            })(),
            return: async () => {
                ended = true;
                return 'ok';
            }
        };
    }
}