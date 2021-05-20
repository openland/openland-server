import { createLogger } from '@openland/log';
import { EndStreamDirectory } from './../repositories/EndStreamDirectory';
import { randomKey } from 'openland-utils/random';
import { Context } from '@openland/context';
import { inTx } from '@openland/foundationdb';
import { ScalableRepository } from './ScalableRepository';
import { Modules } from 'openland-modules/Modules';
import { Store } from 'openland-module-db/FDB';
import { parseSDP } from 'openland-module-calls/sdp/parseSDP';
import { TRANSPORT_PARAMETERS } from 'openland-module-calls/kitchen/MediaKitchenProfiles';
import { extractOpusRtpParameters } from 'openland-module-calls/kitchen/extract';
import { extractFingerprints } from 'openland-module-calls/sdp/extractFingerprints';
import { createMediaDescription, generateSDP } from 'openland-module-calls/kitchen/sdp';
import { RtpParameters } from 'mediakitchen-common';

const logger = createLogger('scalable');

export type ScalableProducerPeerTask =
    | { type: 'add', cid: number, pid: number }
    | { type: 'remove', cid: number, pid: number }
    | { type: 'offer', cid: number, pid: number, sid: string, sdp: string };

function collapseTasks(tasks: ScalableProducerPeerTask[]) {
    let res: ScalableProducerPeerTask[] = [];
    let had = new Set<number>();
    for (let i = tasks.length - 1; i >= 0; i--) {
        if (tasks[i].type === 'add' || tasks[i].type === 'remove') {
            if (had.has(tasks[i].pid)) {
                continue;
            }
            had.add(tasks[i].pid);
        }
        res.unshift(tasks[i]);
    }
    return res;
}

export class ScalableMediator {
    readonly repo = new ScalableRepository();
    readonly endStreamDirectory = new EndStreamDirectory(Store.EndStreamDirectory);

    async onProducerJob(parent: Context, cid: number, raw: ScalableProducerPeerTask[]) {
        const service = Modules.Calls.mediaKitchen;
        const tasks = collapseTasks(raw);

        // Resolve router and worker
        let def = await inTx(parent, async (ctx) => {

            // Resolve worker
            let workerId = await this.repo.getProducerWorkerId(ctx, cid);
            if (!workerId) {

                // TODO: Better algo
                let active = await Store.KitchenWorker.active.findAll(ctx);
                if (active.length === 0) {
                    throw Error('No workers available');
                }
                workerId = active[0].id;

                // Save worker
                this.repo.setProducerWorkerId(ctx, cid, workerId);
            }

            // Resolve router
            let routerId = await this.repo.getProducerRouterId(ctx, cid);
            if (!routerId) {
                routerId = randomKey();
                this.repo.setProducerRouterId(ctx, cid, routerId);
            }

            // Resolve added peers
            let addedTransports: { pid: number, id: string }[] = [];
            for (let t of tasks) {
                if (t.type === 'add') {
                    let transportId = await this.repo.getSpeakerProducerTransport(ctx, cid, t.pid);
                    if (!transportId) {
                        transportId = randomKey();
                        this.repo.setSpeakerProducerTransport(ctx, cid, t.pid, transportId);
                        this.createProducerEndStream(ctx, t.pid, transportId);
                    }
                    addedTransports.push({ pid: t.pid, id: transportId });
                }
            }

            // Resolve offers
            let offers: { pid: number, id: string, sdp: string }[] = [];
            for (let t of tasks) {
                if (t.type === 'offer') {
                    let transportId = await this.repo.getSpeakerProducerTransport(ctx, cid, t.pid);
                    if (transportId || t.sid === transportId) {
                        offers.push({ pid: t.pid, id: t.sid, sdp: t.sdp });
                    }
                }
            }

            // Resolve paused peers
            let pausedTransports: { pid: number, id: string }[] = [];
            for (let t of tasks) {
                if (t.type === 'remove') {
                    let transportId = await this.repo.getSpeakerProducerTransport(ctx, cid, t.pid);
                    if (transportId) {
                        pausedTransports.push({ pid: t.pid, id: transportId });
                    }
                }
            }

            return { workerId, routerId, addedTransports, pausedTransports, offers };
        });

        // Get router if needed
        let router = await service.getOrCreateRouter(def.workerId, def.routerId);

        // Process offers
        let answers: { pid: number, id: string, sdp: string }[] = [];
        for (let offer of def.offers) {
            let sdp;
            let fingerprints: { algorithm: string, value: string }[];
            let rtpParameters: RtpParameters;
            try {
                sdp = parseSDP(offer.sdp);
                fingerprints = extractFingerprints(sdp);
                rtpParameters = extractOpusRtpParameters(sdp.media[0]);
            } catch (e) {
                logger.warn(parent, e);
                continue;
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
        }

        // Commit updates
        await inTx(parent, async (ctx) => {
            for (let answer of answers) {
                this.answerProducerEndStream(ctx, answer.pid, answer.id, answer.sdp);
            }
        });
    }

    private createProducerEndStream(ctx: Context, pid: number, id: string) {
        this.endStreamDirectory.createStream(ctx, id, {
            pid,
            seq: 1,
            state: 'need-offer',
            localCandidates: [],
            remoteCandidates: [],
            localSdp: null,
            remoteSdp: null,
            localStreams: [{ type: 'audio', codec: 'opus', mid: null }],
            remoteStreams: [],
            iceTransportPolicy: 'relay'
        });
        Modules.Calls.repo.notifyPeerChanged(ctx, pid);
    }

    private answerProducerEndStream(ctx: Context, pid: number, id: string, sdp: string) {
        this.endStreamDirectory.incrementSeq(ctx, id, 1);
        this.endStreamDirectory.updateStream(ctx, id, {
            state: 'online',
            remoteSdp: JSON.stringify({ type: 'answer', sdp })
        });
        Modules.Calls.repo.notifyPeerChanged(ctx, pid);
    }
}