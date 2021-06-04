import { createTracer } from 'openland-log/createTracer';
import { createLogger } from '@openland/log';
import { EndStreamDirectory } from './../repositories/EndStreamDirectory';
import { randomKey } from 'openland-utils/random';
import { Context } from '@openland/context';
import { ConsumerEdge, ScalableRepository } from './ScalableRepository';
import { Modules } from 'openland-modules/Modules';
import { Store } from 'openland-module-db/FDB';
import { inTx } from '@openland/foundationdb';
import { IceCandidate, RtpParameters, IceParameters, DtlsParameters } from 'mediakitchen-common';
import { parseSDP } from 'openland-module-calls/sdp/parseSDP';
import { extractFingerprints } from 'openland-module-calls/sdp/extractFingerprints';
import { extractOpusRtpParameters } from 'openland-module-calls/kitchen/extract';
import { ROUTER_CODECS, TRANSPORT_PARAMETERS } from 'openland-module-calls/kitchen/MediaKitchenProfiles';
import { createMediaDescription, generateSDP, getAudioRtpCapabilities } from 'openland-module-calls/kitchen/sdp';
import { convertRtpCapabilitiesToKitchen } from 'openland-module-calls/kitchen/convert';
import { MediaDescription } from 'sdp-transform';
import { ScalableShardRepository } from './ScalableShardRepository';
import { collapseSessionTasks } from './utils/collapseSessionTasks';

const logger = createLogger('scalable');
const tracer = createTracer('kitchen');

export type ScalableShardTask =
    | { type: 'start', cid: number, session: string, shard: string, worker: string }
    | { type: 'stop', cid: number, session: string, shard: string, budget: number }
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

function routerRepeatKey(shard: string) {
    return 'router_' + shard;
}

function transportRepeatKey(transportId: string) {
    return 'transport_' + transportId;
}

function producerRepeatKey(transportId: string) {
    return 'producer_' + transportId;
}

function consumerRepeatKey(transportId: string, producerId: string) {
    return 'consumer_' + transportId + '_' + producerId;
}

export class ScalableMediator {
    readonly repo = new ScalableRepository();
    readonly repoShard = new ScalableShardRepository();
    readonly endStreamDirectory = new EndStreamDirectory(Store.EndStreamDirectory);

    async onSessionJob(ctx: Context, cid: number, tasks: ScalableSessionTask[]) {

        //
        // Handle peers
        //

        let shouldCreateSession = false;
        let shouldDeleteSession = false;
        let session = (await this.repoShard.getCurrentSession(ctx, cid));
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
        logger.log(ctx, 'Session Jobs: ' + JSON.stringify({ peersCount, added, removed, shouldCreateSession, shouldDeleteSession }));

        //
        // Delete session if needed
        //

        if (shouldDeleteSession) {
            await this.repoShard.destroySession(ctx, cid, session!);
            return;
        }

        //
        // Create session if needed
        //

        if (shouldCreateSession) {
            session = await this.repoShard.createSession(ctx, cid);
        }

        // 
        // If no active session exists - nothing to do
        //

        if (!session) {
            return;
        }

        //
        // Apply Updates
        //

        const workers = (await Store.KitchenWorker.active.findAll(ctx))
            .filter((v) => !v.deleted)
            .map((v) => v.id);
        const collapsed = collapseSessionTasks(tasks);
        await this.repoShard.updateSharding(ctx, cid, session,
            workers,
            collapsed.remove,
            collapsed.add,
            collapsed.update
        );
    }

    async onShardJob(parent: Context, cid: number, session: string, shard: string, tasks: ScalableShardTask[]) {
        const log = `[${session}/${shard}]: `;
        logger.log(parent, log + 'Job start');

        try {

            //
            // Stop if needed
            //

            let stopTask = tasks.find((v) => v.type === 'stop');
            if (stopTask && stopTask.type === 'stop') {
                logger.log(parent, log + 'Stop');
                await this.onShardStop(parent, cid, session, shard, stopTask.budget);
                return;
            }

            //
            // Start if needed
            //

            if (tasks.find((v) => v.type === 'start')) {
                logger.log(parent, log + 'Start');
            }

            // Resolve router and worker
            const def = await inTx(parent, async (ctx) => {

                // Check if shard deleted
                if (await this.repo.isShardDeleted(ctx, cid, session, shard)) {
                    logger.log(parent, log + 'Shard already deleted');
                    return null;
                }

                //
                // Resolve Worker
                // 

                let workerId = await this.repo.getShardWorkerId(ctx, cid, session, shard);
                if (!workerId) {
                    if (tasks[0].type !== 'start') {
                        throw Error('Shard not started');
                    }
                    this.repo.setShardWorkerId(ctx, cid, session, shard, tasks[0].worker);
                    workerId = tasks[0].worker;
                }

                //
                // Router
                //

                let existingRouterId = await this.repo.getShardRouterId(ctx, cid, session, shard);

                //
                // Added Producers
                //

                for (let t of tasks) {
                    if (t.type === 'add-producer') {
                        let producer = await this.repo.getShardProducer(ctx, cid, session, shard, t.pid);
                        if (!producer) {
                            logger.log(ctx, log + 'Add producer ' + t.pid);
                            const uuid = randomKey();
                            producer = {
                                pid: t.pid,
                                uuid,
                                transport: null,
                                paused: false,
                                wantPaused: false
                            };
                            this.repo.setShardProducer(ctx, cid, session, shard, t.pid, producer);
                            this.repo.createProducerEndStream(ctx, cid, session, shard, t.pid, uuid);
                            Modules.Calls.repo.notifyPeerChanged(ctx, t.pid);
                        } else {
                            if (producer.wantPaused) {
                                if (producer.transport) {
                                    this.repo.setShardProducer(ctx, cid, session, shard, t.pid, { ...producer, wantPaused: false });
                                } else {
                                    this.repo.setShardProducer(ctx, cid, session, shard, t.pid, { ...producer, wantPaused: false, paused: false });
                                }
                            }
                        }
                    }
                }

                //
                // Removed Producers
                //

                for (let t of tasks) {
                    if (t.type === 'remove-producer') {
                        let producer = await this.repo.getShardProducer(ctx, cid, session, shard, t.pid);
                        if (producer && !producer.wantPaused) {
                            if (producer.transport) {
                                this.repo.setShardProducer(ctx, cid, session, shard, t.pid, { ...producer, wantPaused: true });
                            } else {
                                this.repo.setShardProducer(ctx, cid, session, shard, t.pid, { ...producer, paused: true, wantPaused: true });
                            }
                        }
                    }
                }

                //
                // Producer Offers
                //

                let producerOffers: {
                    pid: number,
                    uuid: string,
                    mid: string,
                    port: number,
                    fingerprints: { algorithm: string, value: string }[],
                    rtpParameters: RtpParameters,
                    paused: boolean,

                }[] = [];
                for (let t of tasks) {
                    if (t.type === 'offer') {
                        let producer = await this.repo.getShardProducer(ctx, cid, session, shard, t.pid);
                        if (producer && !producer.transport) {
                            let sdp;
                            let fingerprints: { algorithm: string, value: string }[];
                            let rtpParameters: RtpParameters;
                            try {
                                sdp = parseSDP(t.sdp);
                                fingerprints = extractFingerprints(sdp);
                                rtpParameters = extractOpusRtpParameters(sdp.media[0]);
                            } catch (e) {
                                logger.warn(parent, e);
                                continue; // Ignore on invalid SDP
                            }
                            let mid = sdp.media[0].mid! + ''; // Why?
                            let port = sdp.media[0].port;
                            producerOffers.push({ pid: t.pid, uuid: producer.uuid, mid, port, fingerprints, rtpParameters, paused: producer.wantPaused });
                        }
                    }
                }

                //
                // Add Consumers
                //

                for (let t of tasks) {
                    if (t.type === 'add-consumer') {
                        let consumer = await this.repo.getShardConsumer(ctx, cid, session, shard, t.pid);
                        let caps = await this.repo.getPeerCapabilities(ctx, cid, t.pid);
                        if (!caps) {
                            continue; // Should not happen
                        }
                        if (!consumer) {
                            logger.log(ctx, log + 'Add consumer ' + t.pid);
                            const uuid = randomKey();
                            consumer = {
                                pid: t.pid,
                                uuid,
                                capabilities: caps,
                                transport: null
                            };
                            this.repo.setShardConsumer(ctx, cid, session, shard, t.pid, consumer);
                        }
                    }
                }

                //
                // Remove Consumers
                //
                // TODO: Destroy consumers (do we really need this?)
                //

                for (let t of tasks) {
                    if (t.type === 'remove-consumer') {
                        let consumer = await this.repo.getShardConsumer(ctx, cid, session, shard, t.pid);
                        if (!consumer) {
                            continue; // Not created
                        }
                        logger.log(ctx, log + 'Remove consumer ' + t.pid);
                        // Close end stream if was created
                        if (consumer.transport) {
                            this.repo.completeEndStream(ctx, consumer.uuid);
                            Modules.Calls.repo.notifyPeerChanged(ctx, t.pid);
                        }
                        this.repo.removeShardConsumer(ctx, cid, session, shard, t.pid);
                    }
                }

                //
                // Consumer Answers
                //

                let consumerAnswers: {
                    pid: number,
                    uuid: string,
                    dtlsParameters: DtlsParameters,
                    transport: {
                        id: string;
                        iceCandates: IceCandidate[];
                        iceParameters: IceParameters;
                        dtlsParameters: DtlsParameters;
                        connected: boolean;
                        connectedTo: ConsumerEdge[];
                    }
                }[] = [];
                for (let t of tasks) {
                    if (t.type === 'answer') {

                        // Find consumer that does not connected
                        let consumer = await this.repo.getShardConsumer(ctx, cid, session, shard, t.pid);
                        if (!consumer || !consumer.transport || consumer.transport.connected) {
                            continue;
                        }

                        // Parse SDP
                        let sdp;
                        let fingerprints: { algorithm: string, value: string }[];
                        try {
                            sdp = parseSDP(t.sdp);
                            fingerprints = extractFingerprints(sdp);
                        } catch (e) {
                            logger.warn(parent, e);
                            continue; // Ignore on invalid SDP
                        }

                        // Schedule connecting
                        consumerAnswers.push({
                            pid: t.pid,
                            uuid: consumer.uuid,
                            transport: consumer.transport,
                            dtlsParameters: { fingerprints, role: 'client' }
                        });
                    }
                }

                let currentProducers = await this.repo.getShardProducers(ctx, cid, session, shard);
                let currentConsumers = await this.repo.getShardConsumers(ctx, cid, session, shard);
                return {
                    workerId,
                    existingRouterId,
                    producerOffers,
                    consumerAnswers,
                    currentConsumers,
                    currentProducers
                };
            });
            if (!def) {
                return;
            }

            logger.log(parent, log + 'Jobs: ' + JSON.stringify({
                currentConsumers: def.currentConsumers.map((v) => v.pid),
                currentProducers: def.currentProducers.map((v) => v.pid)
            }));

            // Worker
            const worker = Modules.Calls.mediaKitchen.cluster.workers.find((v) => v.id === def.workerId);
            if (!worker) {
                throw Error('Unable to find worker');
            }

            // Router
            let routerId = def.existingRouterId;
            if (!routerId) {
                routerId = (await tracer.trace(parent, 'api.createRouter', () => worker.api.createRouter({ mediaCodecs: ROUTER_CODECS }, routerRepeatKey(shard)))).id;
            }

            // Producers and Consumers
            let producers = def.currentProducers;
            let consumers = def.currentConsumers;

            // TODO: Pause and Unpause producers

            //
            // Process offers
            //

            let producersAnswers: {
                pid: number,
                uuid: string,
                answerSDP: string,
                paused: boolean,
                transport: {
                    id: string,
                    producerId: string,
                    parameters: RtpParameters
                }
            }[] = [];
            let producerOffersPromise: Promise<any> | null = null;
            if (def.producerOffers.length > 0) {
                producerOffersPromise = Promise.all(def.producerOffers.map(async (offer) => {

                    // Create Transport
                    const transport = await tracer.trace(parent, 'api.createWebRtcTransport', () => worker.api.createWebRtcTransport(routerId!, TRANSPORT_PARAMETERS, transportRepeatKey(offer.uuid)));
                    await tracer.trace(parent, 'api.connectWebRtcTransport', () => worker.api.connectWebRtcTransport({ id: transport.id, dtlsParameters: { fingerprints: offer.fingerprints, role: 'server' } }));

                    // Create Producer
                    const producer = await tracer.trace(parent, 'api.createProducer', () => worker.api.createProducer(transport.id, { kind: 'audio', rtpParameters: offer.rtpParameters, paused: false }, producerRepeatKey(offer.uuid)));
                    if (offer.paused) {
                        await tracer.trace(parent, 'api.pauseProducer', () => worker.api.pauseProducer(producer.id));
                    } else {
                        // Should not needed
                        // await tracer.trace(parent, 'api.resumeProducer', () => worker.api.resumeProducer(producer.id));
                    }

                    // Create answer
                    let media = [createMediaDescription(offer.mid, 'audio', offer.port, 'recvonly', true, producer.rtpParameters, transport.iceCandidates)];
                    let answer = generateSDP(transport.dtlsParameters.fingerprints, transport.iceParameters, media);
                    producersAnswers.push({
                        pid: offer.pid,
                        uuid: offer.uuid,
                        answerSDP: answer, transport: {
                            id: transport.id,
                            producerId: producer.id,
                            parameters: producer.rtpParameters
                        },
                        paused: offer.paused
                    });
                    producers.push({
                        pid: offer.pid,
                        uuid: offer.uuid,
                        transport: {
                            id: transport.id,
                            producerId: producer.id,
                            parameters: producer.rtpParameters
                        },
                        wantPaused: offer.paused,
                        paused: offer.paused
                    });
                }));
            }

            //
            // Process answers
            //

            let consumerConnected: { pid: number, uuid: string }[] = [];
            let consumerAnswersPromise: Promise<any> | null = null;
            if (def.consumerAnswers.length > 0) {
                consumerAnswersPromise = Promise.all(def.consumerAnswers.map(async (answer) => {
                    await tracer.trace(parent, 'api.connectWebRtcTransport', () => worker.api.connectWebRtcTransport({ id: answer.transport.id, dtlsParameters: answer.dtlsParameters }));
                    consumerConnected.push({ pid: answer.pid, uuid: answer.uuid });
                }));
            }

            // Await producer offers to collect all missing producers
            if (producerOffersPromise) {
                await producerOffersPromise;
            }

            //
            // Update Consumers
            //

            logger.log(parent, log + 'Mid-flight: ' + JSON.stringify({
                currentConsumers: consumers.map((v) => v.pid),
                currentProducers: producers.map((v) => v.pid)
            }));
            let addedConsumers: {
                pid: number,
                uuid: string,
                createdTransport: {
                    id: string,
                    iceCandidates: IceCandidate[],
                    iceParameters: IceParameters,
                    dtlsParameters: DtlsParameters,
                } | null,
                added: ConsumerEdge[]
            }[] = [];

            if (producers.length > 0 && consumers.length > 0) {

                // Update all consumers
                await Promise.all(consumers.map(async (consumer) => {

                    // Find missing producers
                    const missingProducers = producers.filter((p) => {
                        if (p.pid === consumer.pid) {
                            return false;
                        }
                        if (!p.transport || p.wantPaused) {
                            return false;
                        }
                        if (!consumer.transport) {
                            return true;
                        }
                        return !consumer.transport.connectedTo.find((v) => v.producerId === p.transport!.producerId);
                    });
                    if (missingProducers.length === 0) {
                        return;
                    }

                    // Create consumer transport
                    let transportId: string;
                    let created: {
                        id: string,
                        iceCandidates: IceCandidate[],
                        iceParameters: IceParameters,
                        dtlsParameters: DtlsParameters,
                    } | null = null;
                    if (!consumer.transport) {
                        const transport = await tracer.trace(parent, 'api.createWebRtcTransport', () => worker.api.createWebRtcTransport(routerId!, TRANSPORT_PARAMETERS, transportRepeatKey(consumer.uuid)));
                        transportId = transport.id;
                        created = {
                            id: transportId,
                            iceCandidates: transport.iceCandidates,
                            iceParameters: transport.iceParameters,
                            dtlsParameters: transport.dtlsParameters
                        };
                    } else {
                        transportId = consumer.transport.id;
                    }

                    // Create Consumers
                    const rtpCapabilities = convertRtpCapabilitiesToKitchen(getAudioRtpCapabilities(consumer.capabilities));
                    const added: ConsumerEdge[] = [];
                    await Promise.all(missingProducers.map(async (p) => {
                        const cons = await tracer.trace(parent, 'WebRtcTransport.consume', () =>
                            worker.api.createConsumer(transportId, p.transport!.producerId, { rtpCapabilities, paused: false }, consumerRepeatKey(consumer.uuid, p.transport!.producerId))
                        );
                        added.push({ consumerId: cons.id, pid: p.pid, producerId: p.transport!.producerId, parameters: cons.rtpParameters });
                    }));

                    // Schedule commit
                    addedConsumers.push({
                        pid: consumer.pid,
                        uuid: consumer.uuid,
                        createdTransport: created,
                        added,
                    });
                }));
            }

            // Update Producer Pause/Resume
            let producerPaused: { pid: number, paused: boolean }[] = [];
            if (producers.length > 0) {
                await Promise.all(producers.map(async (producer) => {
                    if (!producer.transport) {
                        return;
                    }
                    if (producer.wantPaused !== producer.paused) {
                        if (producer.wantPaused) {
                            await tracer.trace(parent, 'api.pauseProducer', () => worker.api.pauseProducer(producer.transport!.producerId));
                        } else {
                            await tracer.trace(parent, 'api.resumeProducer', () => worker.api.resumeProducer(producer.transport!.producerId));
                        }
                        producerPaused.push({ pid: producer.pid, paused: producer.wantPaused });
                    }
                }));
            }

            // Consumers Connection
            if (consumerAnswersPromise) {
                await consumerAnswersPromise;
            }

            // Commit updates
            await inTx(parent, async (ctx) => {

                // Persist Router Id
                this.repo.setShardRouterId(ctx, cid, session, shard, routerId!);

                // Persist Producer Answers
                for (let answer of producersAnswers) {
                    logger.log(parent, log + 'Created and connected producer transport ' + answer.pid + '/' + answer.uuid);
                    this.repo.setShardProducer(ctx, cid, session, shard, answer.pid, {
                        pid: answer.pid,
                        uuid: answer.uuid,
                        transport: answer.transport,
                        paused: answer.paused,
                        wantPaused: answer.paused
                    });
                    this.repo.answerProducerEndStream(ctx, answer.uuid, answer.answerSDP);
                    Modules.Calls.repo.notifyPeerChanged(ctx, answer.pid);
                }

                // Update producer pause state
                await Promise.all(producerPaused.map(async (paused) => {
                    let producer = await this.repo.getShardProducer(ctx, cid, session, shard, paused.pid);
                    if (!producer) {
                        return;
                    }
                    this.repo.setShardProducer(ctx, cid, session, shard, paused.pid, { ...producer, paused: paused.paused });
                }));

                // Persist Consumer Connected
                await Promise.all(consumerConnected.map(async (connected) => {
                    let consumer = await this.repo.getShardConsumer(ctx, cid, session, shard, connected.pid);
                    if (!consumer || !consumer.transport || consumer.transport.connected) {
                        return;
                    }
                    this.repo.setShardConsumer(ctx, cid, session, shard, connected.pid, { ...consumer, transport: { ...consumer.transport, connected: true } });
                    logger.log(parent, log + 'Connected consumer transport ' + connected.pid + '/' + connected.uuid);
                }));

                // Update consumer
                for (let a of addedConsumers) {
                    let consumer = await this.repo.getShardConsumer(ctx, cid, session, shard, a.pid);
                    if (!consumer) {
                        continue;
                    }

                    // Persist consumer state
                    let wasCreated = !!consumer.transport;
                    if (!consumer.transport) {
                        if (!a.createdTransport) {
                            throw Error('Internal error'); // Should not happen
                        }
                        consumer = {
                            ...consumer,
                            transport: {
                                id: a.createdTransport.id,
                                iceCandates: a.createdTransport.iceCandidates,
                                iceParameters: a.createdTransport.iceParameters,
                                dtlsParameters: a.createdTransport.dtlsParameters,
                                connectedTo: [...a.added],
                                connected: false
                            }
                        };
                        this.repo.setShardConsumer(ctx, cid, session, shard, a.pid, consumer);
                    } else {
                        consumer = {
                            ...consumer,
                            transport: {
                                ...consumer.transport,
                                connectedTo: [...consumer.transport.connectedTo, ...a.added]
                            }
                        };
                        this.repo.setShardConsumer(ctx, cid, session, shard, a.pid, consumer);
                    }

                    //
                    // Update End Stream
                    //
                    let media: Array<{
                        type: string;
                        port: number;
                        protocol: string;
                        payloads?: string;
                    } & MediaDescription> = [];
                    let remoteStreams: ({
                        pid: number,
                        media: { type: 'audio', mid: string } | { type: 'video', source: 'default' | 'screen', mid: string }
                    })[] = [];
                    for (let c of consumer.transport!.connectedTo) {
                        const mid = c.parameters.mid!;
                        media.push(createMediaDescription(mid, 'audio', 7, 'sendonly', true, c.parameters, consumer.transport!.iceCandates!));
                        remoteStreams.push({
                            pid: c.pid,
                            media: { type: 'audio', mid }
                        });
                    }
                    let offer = generateSDP(
                        consumer.transport!.dtlsParameters!.fingerprints,
                        consumer.transport!.iceParameters!,
                        media
                    );
                    if (!wasCreated) {
                        logger.log(parent, log + 'Created consumer transport ' + consumer.pid + '/' + consumer.uuid);
                        this.repo.createConsumerEndStream(ctx, cid, session, shard, consumer.pid, consumer.uuid, offer, remoteStreams);
                    } else {
                        logger.log(parent, log + 'Updated consumer transport ' + consumer.pid + '/' + consumer.uuid);
                        this.repo.updateConsumerEndStream(ctx, consumer.uuid, offer, remoteStreams);
                    }
                    Modules.Calls.repo.notifyPeerChanged(ctx, consumer.pid);
                }
            });
        } finally {
            logger.log(parent, log + 'Job end');
        }
    }

    private async onShardStop(parent: Context, cid: number, session: string, shard: string, budget: number) {

        // Resolve sharding info
        const data = await inTx(parent, async (ctx) => {
            this.repo.markDeleted(ctx, cid, session, shard);

            let workerId = await this.repo.getShardWorkerId(ctx, cid, session, shard);
            if (!workerId) {
                return null;
            }
            let workerRef = await Store.KitchenWorker.findById(ctx, workerId);
            if (!workerRef || workerRef.deleted) {
                return null;
            }

            let routerId = await this.repo.getShardRouterId(ctx, cid, session, shard);
            return { workerId, routerId };
        });

        // If sharding exists - delete media
        if (data) {
            const repeatKey = routerRepeatKey(shard);
            const worker = Modules.Calls.mediaKitchen.cluster.workers.find((v) => v.id === data.workerId);
            if (!worker) {
                throw Error('Unable to find worker');
            }
            if (data.routerId) {
                await tracer.trace(parent, 'api.closeRouter', () => worker.api.closeRouter(data.routerId!));
            } else {
                const routerData = await tracer.trace(parent, 'api.createRouter', () => worker.api.createRouter({ mediaCodecs: ROUTER_CODECS }, repeatKey));
                if (!routerData.closed) {
                    await tracer.trace(parent, 'api.closeRouter', () => worker.api.closeRouter(routerData.id));
                }
            }
        }

        // Commit deletion
        await inTx(parent, async (ctx) => {
            let workerId = await this.repo.getShardWorkerId(ctx, cid, session, shard);
            if (!workerId) {
                return;
            }
            this.repo.clearShardWorkerId(ctx, cid, session, shard);

            // Dealloc worker
            this.repoShard.allocator.deallocWorker(ctx, workerId, budget);
        });
    }
}