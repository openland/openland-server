import { createLogger } from '@openland/log';
import { EndStreamDirectory } from './../repositories/EndStreamDirectory';
import { randomKey } from 'openland-utils/random';
import { Context } from '@openland/context';
// import { inTx } from '@openland/foundationdb';
import { ScalableRepository } from './ScalableRepository';
import { Modules } from 'openland-modules/Modules';
import { Store } from 'openland-module-db/FDB';
import { inTx } from '@openland/foundationdb';
import { RtpParameters } from 'mediakitchen-common';
import { parseSDP } from 'openland-module-calls/sdp/parseSDP';
import { extractFingerprints } from 'openland-module-calls/sdp/extractFingerprints';
import { extractOpusRtpParameters } from 'openland-module-calls/kitchen/extract';
import { TRANSPORT_PARAMETERS } from 'openland-module-calls/kitchen/MediaKitchenProfiles';
import { createMediaDescription, generateSDP } from 'openland-module-calls/kitchen/sdp';
// import { parseSDP } from 'openland-module-calls/sdp/parseSDP';
// import { TRANSPORT_PARAMETERS } from 'openland-module-calls/kitchen/MediaKitchenProfiles';
// import { extractOpusRtpParameters } from 'openland-module-calls/kitchen/extract';
// import { extractFingerprints } from 'openland-module-calls/sdp/extractFingerprints';
// import { createMediaDescription, generateSDP } from 'openland-module-calls/kitchen/sdp';
// import { RtpParameters } from 'mediakitchen-common';

const logger = createLogger('scalable');

export type ScalableShardTask =
    | { type: 'start', cid: number, session: string, shard: string }
    | { type: 'stop', cid: number, session: string, shard: string }
    | { type: 'add-producer', cid: number, session: string, shard: string, pid: number }
    | { type: 'add-consumer', cid: number, session: string, shard: string, pid: number }
    | { type: 'remove-producer', cid: number, session: string, shard: string, pid: number }
    | { type: 'remove-consumer', cid: number, session: string, shard: string, pid: number }
    | { type: 'offer', cid: number, session: string, shard: string, pid: number, sid: string, sdp: string }
    | { type: 'answer', cid: number, session: string, shard: string, pid: number, sid: string, sdp: string };

export type ScalableSessionTask =
    | { type: 'add', cid: number, pid: number, role: 'speaker' | 'listener' }
    | { type: 'role-change', cid: number, pid: number, role: 'speaker' | 'listener' }
    | { type: 'remove', cid: number, pid: number };

export class ScalableMediator {
    readonly repo = new ScalableRepository();
    readonly endStreamDirectory = new EndStreamDirectory(Store.EndStreamDirectory);

    async onSessionJob(ctx: Context, cid: number, tasks: ScalableSessionTask[]) {

        //
        // Handle peers
        //

        let shouldCreateSession = false;
        let shouldDeleteSession = false;
        let session = (await this.repo.getActiveSession(ctx, cid));
        let added = (tasks.filter((v) => v.type === 'add')).map((v) => v.pid);
        let removed = (tasks.filter((v) => v.type === 'remove')).map((v) => v.pid);
        this.repo.addPeersNoCheck(ctx, cid, added, 'main');
        this.repo.removePeersNoCheck(ctx, cid, removed, 'main');
        let peersCount = await this.repo.getPeersCount(ctx, cid, 'main');
        if (peersCount > 0 && session === null) {
            shouldCreateSession = true;
        }
        if (peersCount === 0 && session !== null) {
            shouldDeleteSession = true;
        }

        //
        // Delete session if needed
        //

        if (shouldDeleteSession) {
            await this.repo.sessionStop(ctx, cid, session!);
            const existingShards = await this.repo.getShards(ctx, cid, session!);
            for (let shard of existingShards) {
                await Modules.Calls.repo.schedulerScalable.shardWorker.pushWork(ctx, cid + '_' + session! + '_' + shard.shard, {
                    type: 'stop',
                    cid,
                    session: session!,
                    shard: shard.shard
                });
            }
            this.repo.clearShards(ctx, cid, session!);
            session = null;
        }

        //
        // Create session if needed
        //

        if (shouldCreateSession) {
            session = randomKey();
            await this.repo.sessionCreate(ctx, cid, session);
        }

        // 
        // If no active session exists - nothing to do
        //

        if (!session) {
            return;
        }

        //
        // Allocate assign users
        //

        let shards = await this.repo.getShards(ctx, cid, session);
        const pickShard = (kind: 'producers' | 'consumers') => {
            let res: { shard: string, session: string, kind: 'producers' | 'consumers', count: number } | null = null;
            for (let s of shards) {
                if (s.kind !== kind) {
                    continue;
                }

                // If full
                if (kind === 'producers' && s.count > 5) {
                    continue;
                }
                if (kind === 'consumers' && s.count > 100) {
                    continue;
                }

                if (!res || res.count > s.count) {
                    res = s;
                }
            }
            return res;
        };
        const allocateShard = (kind: 'producers' | 'consumers') => {
            let res: { shard: string, session: string, kind: 'producers' | 'consumers', count: number } = {
                shard: randomKey(),
                session: session!,
                kind,
                count: 0
            };
            shards.push(res);
            this.repo.addShard(ctx, cid, res.session, res.shard, kind);
            return res;
        };

        //
        // Add users
        //

        for (let t of tasks) {
            if (t.type === 'add') {

                // Producer
                if (t.role === 'speaker') {

                    //
                    // Resolve shard
                    //

                    let picked = pickShard('producers');
                    if (!picked) {
                        picked = allocateShard('producers');
                        await Modules.Calls.repo.schedulerScalable.shardWorker.pushWork(ctx, cid + '_' + session! + '_' + picked.shard, {
                            type: 'start',
                            cid,
                            session: session!,
                            shard: picked.shard
                        });
                    }

                    //
                    // Add Peer to Shard
                    //

                    this.repo.addPeerToShard(ctx, cid, session, picked.shard, 'producers', t.pid);
                    this.repo.setPeerShardReference(ctx, cid, session, 'producers', t.pid, picked.shard);
                    await Modules.Calls.repo.schedulerScalable.shardWorker.pushWork(ctx, cid + '_' + session! + '_' + picked.shard, {
                        type: 'add-producer',
                        cid,
                        session: session!,
                        shard: picked.shard,
                        pid: t.pid
                    });
                }

                //
                // Consumers
                //

                let pickedShard = pickShard('consumers');
                if (!pickedShard) {
                    pickedShard = allocateShard('consumers');
                    await Modules.Calls.repo.schedulerScalable.shardWorker.pushWork(ctx, cid + '_' + session! + '_' + pickedShard.shard, {
                        type: 'start',
                        cid,
                        session: session!,
                        shard: pickedShard.shard
                    });
                }
                this.repo.addPeerToShard(ctx, cid, session, pickedShard.shard, 'consumers', t.pid);
                this.repo.setPeerShardReference(ctx, cid, session, 'consumers', t.pid, pickedShard.shard);
                await Modules.Calls.repo.schedulerScalable.shardWorker.pushWork(ctx, cid + '_' + session! + '_' + pickedShard.shard, {
                    type: 'add-consumer',
                    cid,
                    session: session!,
                    shard: pickedShard.shard,
                    pid: t.pid
                });
            }

            if (t.type === 'remove') {
                let consumerShard = await this.repo.getPeerShardReference(ctx, cid, session, 'consumers', t.pid);
                let producerShard = await this.repo.getPeerShardReference(ctx, cid, session, 'producers', t.pid);
                if (consumerShard) {
                    await Modules.Calls.repo.schedulerScalable.shardWorker.pushWork(ctx, cid + '_' + session! + '_' + consumerShard, {
                        type: 'remove-consumer',
                        cid,
                        session: session!,
                        shard: consumerShard,
                        pid: t.pid
                    });
                }
                if (producerShard) {
                    await Modules.Calls.repo.schedulerScalable.shardWorker.pushWork(ctx, cid + '_' + session! + '_' + producerShard, {
                        type: 'remove-consumer',
                        cid,
                        session: session!,
                        shard: producerShard,
                        pid: t.pid
                    });
                }
            }

            if (t.type === 'role-change') {
                let producerShard = await this.repo.getPeerShardReference(ctx, cid, session, 'producers', t.pid);
                if (t.role === 'speaker') {
                    // Promoted to speaker
                    if (producerShard) {
                        await Modules.Calls.repo.schedulerScalable.shardWorker.pushWork(ctx, cid + '_' + session! + '_' + producerShard, {
                            type: 'add-producer',
                            cid,
                            session: session!,
                            shard: producerShard,
                            pid: t.pid
                        });
                    } else {
                        let picked = pickShard('producers');
                        if (!picked) {
                            picked = allocateShard('producers');
                            await Modules.Calls.repo.schedulerScalable.shardWorker.pushWork(ctx, cid + '_' + session! + '_' + picked.shard, {
                                type: 'start',
                                cid,
                                session: session!,
                                shard: picked.shard
                            });
                        }
                        this.repo.addPeerToShard(ctx, cid, session, picked.shard, 'producers', t.pid);
                        this.repo.setPeerShardReference(ctx, cid, session, 'producers', t.pid, picked.shard);
                        await Modules.Calls.repo.schedulerScalable.shardWorker.pushWork(ctx, cid + '_' + session! + '_' + picked.shard, {
                            type: 'add-producer',
                            cid,
                            session: session!,
                            shard: picked.shard,
                            pid: t.pid
                        });
                    }
                } else {
                    // Demoted to listener
                    if (producerShard) {
                        await Modules.Calls.repo.schedulerScalable.shardWorker.pushWork(ctx, cid + '_' + session! + '_' + producerShard, {
                            type: 'remove-producer',
                            cid,
                            session: session!,
                            shard: producerShard,
                            pid: t.pid
                        });
                    }
                }
            }
        }
    }

    async onShardJob(parent: Context, cid: number, session: string, shard: string, tasks: ScalableShardTask[]) {
        const service = Modules.Calls.mediaKitchen;

        // Stop if needed
        if (tasks.find((v) => v.type === 'stop')) {
            let data = await inTx(parent, async (ctx) => {
                this.repo.markDeleted(ctx, cid, session, shard);

                let workerId = await this.repo.getShardWorkerId(ctx, cid, session, shard);
                if (!workerId) {
                    return null;
                }
                let routerId = await this.repo.getShardRouterId(ctx, cid, session, shard);
                if (!routerId) {
                    return null;
                }

                let workerRef = await Store.KitchenWorker.findById(ctx, workerId);
                if (!workerRef || workerRef.deleted) {
                    return;
                }

                return { workerId, routerId };
            });

            if (data) {
                let routerToDelete = await Modules.Calls.mediaKitchen.getOrCreateRouter(data.workerId, data.routerId);
                await routerToDelete.close();
            }

            return;
        }

        // Resolve router and worker
        let def = await inTx(parent, async (ctx) => {

            // Check if shard deleted
            if (await this.repo.isShardDeleted(ctx, cid, session, shard)) {
                return null;
            }

            //
            // Resolve Worker
            // 

            let workerId = await this.repo.getShardWorkerId(ctx, cid, session, shard);
            if (!workerId) {

                // TODO: Better algo
                let active = await Store.KitchenWorker.active.findAll(ctx);
                if (active.length === 0) {
                    throw Error('No workers available');
                }
                workerId = active[0].id;

                // Save worker
                this.repo.setShardWorkerId(ctx, cid, session, workerId, shard);
            }

            //
            // Router
            //

            let routerId = await this.repo.getShardRouterId(ctx, cid, session, shard);
            if (!routerId) {
                routerId = randomKey();
                this.repo.setShardRouterId(ctx, cid, session, routerId, shard);
            }

            //
            // Added Producers
            //

            let addedProducersTransports: { pid: number, id: string }[] = [];
            for (let t of tasks) {
                if (t.type === 'add-producer') {
                    let transportId = await this.repo.getProducerTransport(ctx, cid, session, shard, t.pid);
                    if (!transportId) {
                        transportId = randomKey();
                        this.repo.setProducerTransport(ctx, cid, session, shard, t.pid, transportId);
                        this.repo.createProducerEndStream(ctx, cid, session, shard, t.pid, transportId);
                        Modules.Calls.repo.notifyPeerChanged(ctx, t.pid);
                    }
                    addedProducersTransports.push({ pid: t.pid, id: transportId });
                }
            }

            //
            // Removed Producers
            //

            //
            // Producer Offers
            //

            let offers: { pid: number, id: string, sdp: string }[] = [];
            for (let t of tasks) {
                if (t.type === 'offer') {
                    let transportId = await this.repo.getProducerTransport(ctx, cid, session, shard, t.pid);
                    if (transportId || t.sid === transportId) {
                        offers.push({ pid: t.pid, id: t.sid, sdp: t.sdp });
                    }
                }
            }

            return { workerId, routerId, addedProducersTransports, offers };
        });
        if (!def) {
            return;
        }

        // Router
        let router = await service.getOrCreateRouter(def.workerId, def.routerId);

        // TODO: Pause and Unpause producers

        // Process offers
        let answers: { pid: number, id: string, sdp: string }[] = [];
        await Promise.all(def.offers.map(async (offer) => {
            let sdp;
            let fingerprints: { algorithm: string, value: string }[];
            let rtpParameters: RtpParameters;
            try {
                sdp = parseSDP(offer.sdp);
                fingerprints = extractFingerprints(sdp);
                rtpParameters = extractOpusRtpParameters(sdp.media[0]);
            } catch (e) {
                logger.warn(parent, e);
                return;
            }
            let mid = sdp.media[0].mid! + ''; // Why?
            let port = sdp.media[0].port;

            // Create Transport
            const transport = await router.createWebRtcTransport(TRANSPORT_PARAMETERS, offer.id);
            await transport.connect({ dtlsParameters: { fingerprints } });

            // Create Producer
            const producer = await transport.produce({ kind: 'audio', rtpParameters }, offer.id);

            // Create answer
            let media = [createMediaDescription(mid, 'audio', port, 'recvonly', true, producer.rtpParameters!, transport.iceCandidates)];
            let answer = generateSDP(
                transport.dtlsParameters.fingerprints,
                transport.iceParameters,
                media
            );
            answers.push({ pid: offer.pid, id: offer.id, sdp: answer });
        }));

        // Commit updates
        await inTx(parent, async (ctx) => {
            // Update consumers

            // Answer Streams
            for (let answer of answers) {
                this.repo.answerProducerEndStream(ctx, answer.id, answer.sdp);
                Modules.Calls.repo.notifyPeerChanged(ctx, answer.pid);
            }
        });
    }
}