import { createTracer } from 'openland-log/createTracer';
import { createLogger } from '@openland/log';
import { EndStreamDirectory } from './../repositories/EndStreamDirectory';
import { randomKey } from 'openland-utils/random';
import { Context } from '@openland/context';
// import { inTx } from '@openland/foundationdb';
import { ConsumerEdge, ScalableRepository, TransportSDP } from './ScalableRepository';
import { Modules } from 'openland-modules/Modules';
import { Store } from 'openland-module-db/FDB';
import { inTx } from '@openland/foundationdb';
import { IceCandidate, RtpParameters, IceParameters, DtlsParameters } from 'mediakitchen-common';
import { parseSDP } from 'openland-module-calls/sdp/parseSDP';
import { extractFingerprints } from 'openland-module-calls/sdp/extractFingerprints';
import { extractOpusRtpParameters } from 'openland-module-calls/kitchen/extract';
import { TRANSPORT_PARAMETERS } from 'openland-module-calls/kitchen/MediaKitchenProfiles';
import { createMediaDescription, generateSDP, getAudioRtpCapabilities } from 'openland-module-calls/kitchen/sdp';
import { convertRtpCapabilitiesToKitchen } from 'openland-module-calls/kitchen/convert';
import { MediaDescription } from 'sdp-transform';
import { ScalableShardRepository } from './ScalableShardRepository';
import { collapseSessionTasks } from './utils/collapseSessionTasks';

const logger = createLogger('scalable');
const tracer = createTracer('kitchen');

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

        const collapsed = collapseSessionTasks(tasks);
        await this.repoShard.updateSharding(ctx, cid, session,
            collapsed.remove,
            collapsed.add,
            collapsed.update
        );
    }

    async onShardJob(parent: Context, cid: number, session: string, shard: string, tasks: ScalableShardTask[]) {
        const service = Modules.Calls.mediaKitchen;
        const log = `[${session}/${shard}]: `;
        logger.log(parent, log + 'Job start');

        try {

            // Stop if needed
            if (tasks.find((v) => v.type === 'stop')) {
                logger.log(parent, log + 'Stop');
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

            if (tasks.find((v) => v.type === 'start')) {
                logger.log(parent, log + 'Start');
            }

            // Resolve router and worker
            const def = await inTx(parent, async (ctx) => {

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
                    this.repo.setShardWorkerId(ctx, cid, session, shard, workerId);
                }

                //
                // Router
                //

                let routerId = await this.repo.getShardRouterId(ctx, cid, session, shard);
                if (!routerId) {
                    routerId = randomKey();
                    this.repo.setShardRouterId(ctx, cid, session, shard, routerId);
                }

                //
                // Added Producers
                //

                for (let t of tasks) {
                    if (t.type === 'add-producer') {
                        let transportId = await this.repo.getProducerTransport(ctx, cid, session, shard, t.pid);
                        if (!transportId) {
                            logger.log(ctx, log + 'Add producer ' + t.pid);
                            transportId = randomKey();
                            this.repo.setProducerTransport(ctx, cid, session, shard, t.pid, transportId);
                            this.repo.createProducerEndStream(ctx, cid, session, shard, t.pid, transportId);
                            Modules.Calls.repo.notifyPeerChanged(ctx, t.pid);
                        }
                    }
                }

                //
                // Removed Producers
                //

                // TODO: Implement

                //
                // Producer Offers
                //

                let offers: { pid: number, id: string, sdp: TransportSDP }[] = [];
                for (let t of tasks) {
                    if (t.type === 'offer') {
                        let transportId = await this.repo.getProducerTransport(ctx, cid, session, shard, t.pid);
                        if (t.sid === transportId) {
                            let exSdp = await this.repo.getTransportSdp(ctx, cid, session, shard, t.pid, transportId);
                            if (!exSdp) {
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
                                exSdp = {
                                    mid, port, fingerprints, parameters: rtpParameters
                                };
                                this.repo.setTransportSDP(ctx, cid, session, shard, t.pid, transportId, exSdp);
                            }
                            offers.push({ pid: t.pid, id: t.sid, sdp: exSdp });
                        }
                    }
                }

                //
                // Added Consumers
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
                            consumer = {
                                pid: t.pid,
                                transportId: randomKey(),
                                created: false,
                                connectedTo: [],
                                capabilities: caps,
                                iceCandates: null,
                                iceParameters: null,
                                dtlsParameters: null,
                                connected: false
                            };
                            this.repo.setShardConsumer(ctx, cid, session, shard, t.pid, consumer);
                        }
                    }
                }

                //
                // Removed Consumers
                //

                for (let t of tasks) {
                    if (t.type === 'remove-consumer') {
                        let consumer = await this.repo.getShardConsumer(ctx, cid, session, shard, t.pid);
                        if (!consumer) {
                            continue; // Not created
                        }
                        logger.log(ctx, log + 'Remove consumer ' + t.pid);
                        if (consumer.created) {
                            // Close end stream
                            this.repo.completeEndStream(ctx, consumer.transportId);
                            Modules.Calls.repo.notifyPeerChanged(ctx, t.pid);
                        }
                        this.repo.removeShardConsumer(ctx, cid, session, shard, t.pid);
                    }
                }

                //
                // Consumer Answers
                //
                let consumerAnswers: { pid: number, id: string, dtlsParameters: DtlsParameters }[] = [];
                for (let t of tasks) {
                    if (t.type === 'answer') {
                        let consumer = await this.repo.getShardConsumer(ctx, cid, session, shard, t.pid);
                        if (!consumer || consumer.connected) {
                            continue;
                        }

                        let sdp;
                        let fingerprints: { algorithm: string, value: string }[];
                        try {
                            sdp = parseSDP(t.sdp);
                            fingerprints = extractFingerprints(sdp);
                        } catch (e) {
                            logger.warn(parent, e);
                            continue; // Ignore on invalid SDP
                        }
                        consumerAnswers.push({ pid: t.pid, id: consumer.transportId, dtlsParameters: { fingerprints } });
                    }
                }

                let currentProducers = await this.repo.getShardProducers(ctx, cid, session, shard);
                let currentConsumers = await this.repo.getShardConsumers(ctx, cid, session, shard);
                return { workerId, routerId, offers, consumerAnswers, currentConsumers, currentProducers };
            });
            if (!def) {
                return;
            }

            logger.log(parent, log + 'Jobs: ' + JSON.stringify({
                currentConsumers: def.currentConsumers.map((v) => v.pid),
                currentProducers: def.currentProducers.map((v) => v.pid)
            }));

            // Router
            let producers = def.currentProducers;
            let consumers = def.currentConsumers;
            let router = await tracer.trace(parent, 'Worker.getOrCreateRouter', () => service.getOrCreateRouter(def.workerId, def.routerId));

            // TODO: Pause and Unpause producers

            //
            // Process offers
            //

            let answers: { pid: number, id: string, sdp: string, producer: string, parameters: RtpParameters }[] = [];
            for (let offer of def.offers) {

                // Create Transport
                const transport = await tracer.trace(parent, 'Router.createWebRtcTransport', () => router.createWebRtcTransport(TRANSPORT_PARAMETERS, offer.id));
                await tracer.trace(parent, 'WebRtcTransport.connect', () => transport.connect({ dtlsParameters: { fingerprints: offer.sdp.fingerprints } }));

                // Create Producer
                const producer = await tracer.trace(parent, 'WebRtcTransport.produce', () => transport.produce({ kind: 'audio', rtpParameters: offer.sdp.parameters }, offer.id));

                // Create answer
                let media = [createMediaDescription(offer.sdp.mid, 'audio', offer.sdp.port, 'recvonly', true, producer.rtpParameters, transport.iceCandidates)];
                let answer = generateSDP(transport.dtlsParameters.fingerprints, transport.iceParameters, media);
                answers.push({ pid: offer.pid, id: offer.id, sdp: answer, producer: producer.id, parameters: producer.rtpParameters });
                producers.push({ pid: offer.pid, remote: false, producerId: producer.id, parameters: producer.rtpParameters });
            }

            //
            // Process answers
            //

            let answered: { pid: number, id: string }[] = [];
            for (let answer of def.consumerAnswers) {
                const transport = await tracer.trace(parent, 'Router.createWebRtcTransport', () => router.createWebRtcTransport(TRANSPORT_PARAMETERS, answer.id));
                await tracer.trace(parent, 'WebRtcTransport.connect', () => transport.connect({ dtlsParameters: answer.dtlsParameters }));
                answered.push({ pid: answer.pid, id: answer.id });
            }

            //
            // Update Consumers
            //

            logger.log(parent, log + 'Mid-flight: ' + JSON.stringify({
                currentConsumers: consumers.map((v) => v.pid),
                currentProducers: producers.map((v) => v.pid)
            }));
            let addedConsumers: {
                pid: number, id: string,
                iceCandidates: IceCandidate[],
                iceParameters: IceParameters,
                dtlsParameters: DtlsParameters,
                added: ConsumerEdge[]
            }[] = [];
            if (producers.length > 0 && consumers.length > 0) {
                for (let consumer of consumers) {
                    logger.log(parent, log + 'Update consumer: ' + JSON.stringify({ pid: consumer.pid }));
                    const transport = await tracer.trace(parent, 'Router.createWebRtcTransport', () => router.createWebRtcTransport(TRANSPORT_PARAMETERS, consumer.transportId));
                    const added: ConsumerEdge[] = [];
                    for (let p of producers) {
                        logger.log(parent, log + 'Found producer: ' + JSON.stringify({ pid: p.pid }));
                        if (p.pid === consumer.pid) {
                            logger.log(parent, log + 'Same pid');
                            continue;
                        }
                        if (!consumer.connectedTo.find((v) => v.producerId === p.producerId)) {
                            const cons = await tracer.trace(parent, 'WebRtcTransport.consume', () => transport.consume(p.producerId, {
                                rtpCapabilities: convertRtpCapabilitiesToKitchen(getAudioRtpCapabilities(consumer.capabilities))
                            }, consumer.transportId + '-' + p.producerId));
                            added.push({ consumerId: cons.id, producerId: p.producerId, parameters: cons.rtpParameters });
                            logger.log(parent, log + 'Create new');
                        } else {
                            logger.log(parent, log + 'Already exist');
                        }
                    }
                    if (added.length > 0) {
                        addedConsumers.push({
                            pid: consumer.pid,
                            id: consumer.transportId,
                            added,
                            iceCandidates: transport.iceCandidates,
                            iceParameters: transport.iceParameters,
                            dtlsParameters: transport.dtlsParameters
                        });
                    }
                }
            }

            // Commit updates
            await inTx(parent, async (ctx) => {

                // Persist Answers
                for (let answer of answers) {
                    logger.log(parent, log + 'Connected and connected producer transport ' + answer.pid + '/' + answer.id);
                    this.repo.addProducerToShard(ctx, cid, session, shard, answer.pid, false, answer.producer, answer.parameters);
                    this.repo.answerProducerEndStream(ctx, answer.id, answer.sdp);
                    Modules.Calls.repo.notifyPeerChanged(ctx, answer.pid);
                }

                // Persist Consumer Answers
                for (let connected of answered) {
                    let consumer = await this.repo.getShardConsumer(ctx, cid, session, shard, connected.pid);
                    if (!consumer || consumer.connected) {
                        continue;
                    }
                    this.repo.setShardConsumer(ctx, cid, session, shard, connected.pid, { ...consumer, connected: true });
                    logger.log(parent, log + 'Connected consumer transport ' + connected.pid + '/' + connected.id);
                }

                // Update consumer
                for (let a of addedConsumers) {
                    let consumer = await this.repo.getShardConsumer(ctx, cid, session, shard, a.pid);
                    if (!consumer) {
                        continue;
                    }
                    let wasCreated = consumer.created;
                    consumer = {
                        ...consumer,
                        iceCandates: a.iceCandidates,
                        iceParameters: a.iceParameters,
                        dtlsParameters: a.dtlsParameters,
                        created: true,
                        connectedTo: [...consumer.connectedTo, ...a.added]
                    };
                    this.repo.setShardConsumer(ctx, cid, session, shard, a.pid, consumer);

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
                    for (let c of consumer.connectedTo) {
                        const mid = c.parameters.mid!;
                        media.push(createMediaDescription(mid, 'audio', 7, 'sendonly', true, c.parameters, consumer.iceCandates!));
                        remoteStreams.push({
                            pid: consumer.pid,
                            media: { type: 'audio', mid }
                        });
                    }
                    let offer = generateSDP(
                        consumer.dtlsParameters!.fingerprints,
                        consumer.iceParameters!,
                        media
                    );
                    if (!wasCreated) {
                        logger.log(parent, log + 'Created consumer transport ' + consumer.pid + '/' + consumer.transportId);
                        this.repo.createConsumerEndStream(ctx, cid, session, shard, consumer.pid, consumer.transportId, offer, remoteStreams);
                    } else {
                        logger.log(parent, log + 'Updated consumer transport ' + consumer.pid + '/' + consumer.transportId);
                        this.repo.updateConsumerEndStream(ctx, consumer.transportId, offer, remoteStreams);
                    }
                    Modules.Calls.repo.notifyPeerChanged(ctx, consumer.pid);
                }
            });
        } finally {
            logger.log(parent, log + 'Job end');
        }
    }
}