import { randomKey } from 'openland-utils/random';
import { encoders, Subspace, TupleItem } from '@openland/foundationdb';
import { Context } from '@openland/context';
import { Store } from 'openland-module-db/FDB';
import { SyncWorkerQueue } from 'openland-module-workers/SyncWorkerQueue';
import { ScalableShardTask } from './ScalableMediator';
import { createLogger } from '@openland/log';

type ShardMode =
    | { type: 'simple', shard: string }
    | { type: 'scalable', shard: string, producersShard: string[], consumersShard: string[] };

function workerKey(cid: number, session: string, shard: string) {
    return cid + '_' + session + '_' + shard;
}

const logger = createLogger('scalable');

export type PeerState = { pid: number, producer: boolean, consumer: boolean };

export class ScalableShardRepository {

    readonly shardWorker = new SyncWorkerQueue<string, ScalableShardTask>(Store.ConferenceScalableShardsQueue, { maxAttempts: 'infinite', type: 'external' });

    private readonly sessions: Subspace<TupleItem[], string>;
    private readonly shardMode: Subspace<TupleItem[], ShardMode>;
    private readonly peerShards: Subspace<TupleItem[], boolean>;

    constructor() {
        this.shardMode = Store.ConferenceScalableShardingDirectory
            .subspace(encoders.tuple.pack([0]))
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.json);
        this.peerShards = Store.ConferenceScalableShardingDirectory
            .subspace(encoders.tuple.pack([1]))
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.boolean);
        this.sessions = Store.ConferenceScalableShardingDirectory
            .subspace(encoders.tuple.pack([2]))
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.string);
    }

    async getShardingState(ctx: Context, cid: number, session: string) {
        let mode = await this.shardMode.get(ctx, [cid, session]);
        let peers = (await this.peerShards.range(ctx, [cid, session])).map((v) => ({
            pid: v.key[2] as number,
            shard: v.key[3] as string,
            kind: (v.key[4] === 0 ? 'producer' : 'consumer') as 'producer' | 'consumer',
            enabled: v.value
        }));
        return {
            mode,
            peers
        };
    }

    getCurrentSession(ctx: Context, cid: number) {
        return this.sessions.get(ctx, [cid]);
    }

    async createSession(ctx: Context, cid: number) {
        const session = randomKey();
        let existing = await this.sessions.get(ctx, [cid]);
        if (existing) {
            throw Error('Session already exists');
        }
        this.sessions.set(ctx, [cid], session);

        logger.log(ctx, `[${session}]: Start session`);

        return session;
    }

    async destroySession(ctx: Context, cid: number, session: string) {

        // Clear session reference
        let existing = await this.sessions.get(ctx, [cid]);
        if (existing !== session) {
            throw Error('Session does not exist');
        }
        this.sessions.clear(ctx, [cid]);

        logger.log(ctx, `[${session}]: Stop session`);

        // Stop shards
        let mode = await this.shardMode.get(ctx, [cid, session]);
        if (mode) {
            if (mode.type === 'simple') {
                logger.log(ctx, `[${session}/${mode.shard}]: Stop shard`);
                await this.shardWorker.pushWork(ctx, workerKey(cid, session, mode.shard), { type: 'stop', cid, session, shard: mode.shard });
            }
            if (mode.type === 'scalable') {
                logger.log(ctx, `[${session}/${mode.shard}]: Stop shard`);
                await this.shardWorker.pushWork(ctx, workerKey(cid, session, mode.shard), { type: 'stop', cid, session, shard: mode.shard });
                for (let p of mode.producersShard) {
                    logger.log(ctx, `[${session}/${p}]: Stop shard`);
                    await this.shardWorker.pushWork(ctx, workerKey(cid, session, p), { type: 'stop', cid, session, shard: p });
                }
                for (let p of mode.consumersShard) {
                    logger.log(ctx, `[${session}/${p}]: Stop shard`);
                    await this.shardWorker.pushWork(ctx, workerKey(cid, session, p), { type: 'stop', cid, session, shard: p });
                }
            }
        }

        // Delete shard data
        this.shardMode.clear(ctx, [cid, session]);
        this.peerShards.clearPrefixed(ctx, [cid, session]);
    }

    async updateSharding(ctx: Context, cid: number, session: string,
        removePeers: number[],
        addPeers: PeerState[],
        updatePeers: PeerState[]
    ) {

        // Create sharding mode if not exist
        let mode = await this.shardMode.get(ctx, [cid, session]);
        if (!mode) {
            const allocatedShard = randomKey();
            mode = { type: 'simple', shard: allocatedShard };
            this.shardMode.set(ctx, [cid, session], mode);
            logger.log(ctx, `[${session}/${allocatedShard}]: Start shard`);
            await this.shardWorker.pushWork(ctx, workerKey(cid, session, allocatedShard), { type: 'start', cid, session, shard: allocatedShard });
        }

        // Remove peers
        for (let r of removePeers) {
            let shards = await this.getPeerShards(ctx, cid, session, r);
            for (let sh of shards) {
                this.removePeerFromShard(ctx, cid, session, r, sh.shard, sh.kind);
                if (sh.kind === 'producer') {
                    await this.shardWorker.pushWork(ctx, workerKey(cid, session, sh.shard), { type: 'remove-producer', cid, session, shard: sh.shard, pid: r });
                }
                if (sh.kind === 'consumer') {
                    await this.shardWorker.pushWork(ctx, workerKey(cid, session, sh.shard), { type: 'remove-consumer', cid, session, shard: sh.shard, pid: r });
                }
            }
        }

        // TODO: Perform scheduling
        const shard = mode.shard;

        // Add peers
        for (let p of addPeers) {
            if (p.consumer) {
                this.setPeerToShard(ctx, cid, session, p.pid, shard, 'consumer', true);
                await this.shardWorker.pushWork(ctx, workerKey(cid, session, shard), { type: 'add-consumer', cid, session, shard: shard, pid: p.pid });
            }
            if (p.producer) {
                this.setPeerToShard(ctx, cid, session, p.pid, shard, 'producer', true);
                await this.shardWorker.pushWork(ctx, workerKey(cid, session, shard), { type: 'add-producer', cid, session, shard: shard, pid: p.pid });
            }
        }

        // Update peers
        for (let u of updatePeers) {
            let allocatedShards = await this.getPeerShards(ctx, cid, session, u.pid);

            // Remove consumers
            if (!u.consumer) {
                for (let sh of allocatedShards) {
                    if (sh.kind === 'consumer') {
                        this.removePeerFromShard(ctx, cid, session, u.pid, sh.shard, 'consumer');
                        await this.shardWorker.pushWork(ctx, workerKey(cid, session, sh.shard), { type: 'remove-consumer', cid, session, shard: sh.shard, pid: u.pid });
                    }
                }
            }

            // Add consumers
            if (u.consumer) {
                if (!allocatedShards.find((v) => v.kind === 'consumer')) {
                    this.setPeerToShard(ctx, cid, session, u.pid, shard, 'consumer', true);
                    await this.shardWorker.pushWork(ctx, workerKey(cid, session, shard), { type: 'add-consumer', cid, session, shard: shard, pid: u.pid });
                }
            }

            // Remove producers
            if (!u.producer) {
                for (let sh of allocatedShards) {
                    if (sh.kind === 'producer' && sh.enabled) {
                        this.setPeerToShard(ctx, cid, session, u.pid, sh.shard, 'producer', false);
                        await this.shardWorker.pushWork(ctx, workerKey(cid, session, sh.shard), { type: 'remove-producer', cid, session, shard: sh.shard, pid: u.pid });
                    }
                }
            }

            // Add producers
            if (u.producer) {
                let existing = allocatedShards.find((v) => v.kind === 'producer');
                if (existing) {
                    if (!existing.enabled) {
                        this.setPeerToShard(ctx, cid, session, u.pid, existing.shard, 'producer', true);
                        await this.shardWorker.pushWork(ctx, workerKey(cid, session, existing.shard), { type: 'add-producer', cid, session, shard: existing.shard, pid: u.pid });
                    }
                } else {
                    this.setPeerToShard(ctx, cid, session, u.pid, shard, 'producer', true);
                    await this.shardWorker.pushWork(ctx, workerKey(cid, session, shard), { type: 'add-producer', cid, session, shard: shard, pid: u.pid });
                }
            }
        }
    }

    private setPeerToShard(ctx: Context, cid: number, session: string, pid: number, shard: string, kind: 'consumer' | 'producer', enabled: boolean) {
        this.peerShards.set(ctx, [cid, session, pid, shard, kind === 'producer' ? 0 : 1], enabled);
    }

    private removePeerFromShard(ctx: Context, cid: number, session: string, pid: number, shard: string, kind: 'consumer' | 'producer') {
        this.peerShards.clear(ctx, [cid, session, pid, shard, kind === 'producer' ? 0 : 1]);
    }

    private async getPeerShards(ctx: Context, cid: number, session: string, pid: number) {
        return (await this.peerShards.range(ctx, [cid, session, pid])).map((v) => ({
            shard: v.key[3] as string,
            kind: (v.key[4] === 0 ? 'producer' : 'consumer') as 'producer' | 'consumer',
            enabled: v.value
        }));
    }
}