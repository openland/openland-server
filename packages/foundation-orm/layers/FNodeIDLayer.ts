import { FConnection } from 'foundation-orm/FConnection';
import { createNamedContext } from '@openland/context';
import { randomKey } from 'openland-utils/random';
import { delay } from 'openland-utils/timer';
import { createLogger } from '@openland/log';
import { encoders, Subspace, inTx } from '@openland/foundationdb';
import { Tuple } from '@openland/foundationdb/lib/encoding';

const rootCtx = createNamedContext('fdb-node-id');
const log = createLogger('node-id-layer');

export class FNodeIDLayer {
    private readonly connection: FConnection;
    private readonly keyspace: Subspace<Tuple[], any>;
    private seed = randomKey();
    private readyPromise!: Promise<void>;
    private _nodeId = 0;
    private _registered = false;

    constructor(connection: FConnection) {
        this.connection = connection;

        this.keyspace = this.connection.allKeys
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.json)
            .subspace(['__system', '__nodeid']);

        this.start();
    }

    public get nodeId(): number {
        if (!this._registered) {
            throw Error('NodeID layer is not ready');
        }
        return this._nodeId;
    }

    async ready() {
        await this.readyPromise;
    }

    private start() {
        this.readyPromise = (async () => {
            while (true) {
                let candidate = Math.round(Math.random() * 1023);
                let now = Date.now();
                // if (!process.env.JEST_WORKER_ID) {
                log.log(rootCtx, 'Check if ' + candidate + ' is available');
                // }

                let res = await inTx(rootCtx, async (ctx) => {
                    let existing = await this.keyspace.get(ctx, [candidate]);
                    if (!existing || (existing.timeout < now)) {
                        this.keyspace.set(ctx, [candidate], { timeout: now + 30000, seed: this.seed });
                        return true;
                    } else {
                        return false;
                    }
                });
                if (res) {
                    this.onRegistered(candidate);

                    // Start Refresh Loop
                    // tslint:disable:no-floating-promises
                    (async () => {
                        while (true) {
                            let updated = await inTx(rootCtx, async (ctx) => {
                                let existing = await this.keyspace.get(ctx, [candidate]);
                                if (existing && (existing.seed === this.seed)) {
                                    this.keyspace.set(ctx, [candidate], { timeout: Date.now() + 30000, seed: this.seed });
                                    return true;
                                } else {
                                    return false;
                                }
                            });
                            if (updated) {
                                await delay(5000);
                            } else {
                                this.onHalted();
                            }
                        }
                    })();
                    return;
                }
            }
        })();
    }

    private onRegistered(id: number) {
        this._nodeId = id;
        this._registered = true;
    }

    private onHalted() {
        if (process.env.NODE_ENV === 'production') {
            // Halt NodeJS process
            process.abort();
        }
    }
}