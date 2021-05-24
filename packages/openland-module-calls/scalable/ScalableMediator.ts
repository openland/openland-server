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

export type ScalableConsumerPeerTask =
    | { type: 'add', cid: number, pid: number }
    | { type: 'remove', cid: number, pid: number }
    | { type: 'answer', cid: number, pid: number, sid: string, sdp: string };

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

            //
            // Resolve Session
            //

            // TODO: Handle worker lost

            let session = (await this.repo.getActiveSession(ctx, cid));
            let shouldCreateSession = false;
            let shouldDeleteSession = false;
            for (let t of tasks) {
                if (t.type === 'add') {
                    await this.repo.addPeer(ctx, cid, t.pid, 'producer');
                }
                if (t.type === 'remove') {
                    await this.repo.removePeer(ctx, cid, t.pid, 'producer');
                }
            }
            let peersCount = await this.repo.getPeersCount(ctx, cid, 'producer');
            if (peersCount > 0 && session === null) {
                shouldCreateSession = true;
            }
            if (peersCount === 0 && session !== null) {
                shouldDeleteSession = true;
            }

            //
            // Delete session
            //

            if (shouldDeleteSession) {
                await this.repo.sessionStop(ctx, cid, session!);
                Modules.Calls.repo.schedulerScalable.purgeWorker.pushWork(ctx, { sid: session!, cid });
                session = null;
            }

            //
            // Create Session
            //

            if (shouldCreateSession) {
                await this.repo.sessionCreate(ctx, cid, randomKey());
                session = randomKey();
            }

            // 
            // If no active session exists - nothing to do
            //

            if (!session) {
                return null;
            }

            //
            // Pick worker
            //

            let workerId = await this.repo.getSessionWorkerId(ctx, cid, session);
            if (!workerId) {

                // TODO: Better algo
                let active = await Store.KitchenWorker.active.findAll(ctx);
                if (active.length === 0) {
                    throw Error('No workers available');
                }
                workerId = active[0].id;

                // Save worker
                this.repo.setSessionWorkerId(ctx, cid, session, workerId);
            }

            //
            // Router
            //

            let routerId = await this.repo.getSessionRouterId(ctx, cid, session);
            if (!routerId) {
                routerId = randomKey();
                this.repo.setSessionRouterId(ctx, cid, session, routerId);
            }

            //
            // Resolve added peers
            //

            let addedTransports: { pid: number, id: string }[] = [];
            for (let t of tasks) {
                if (t.type === 'add') {
                    let transportId = await this.repo.getProducerTransport(ctx, cid, t.pid, session);
                    if (!transportId) {
                        transportId = randomKey();
                        this.repo.setProducerTransport(ctx, cid, t.pid, session, transportId);
                        this.repo.createProducerEndStream(ctx, t.pid, transportId);
                        Modules.Calls.repo.notifyPeerChanged(ctx, t.pid);
                    }
                    addedTransports.push({ pid: t.pid, id: transportId });
                }
            }

            //
            // Resolve offers
            //

            let offers: { pid: number, id: string, sdp: string }[] = [];
            for (let t of tasks) {
                if (t.type === 'offer') {
                    let transportId = await this.repo.getProducerTransport(ctx, cid, t.pid, session);
                    if (transportId || t.sid === transportId) {
                        offers.push({ pid: t.pid, id: t.sid, sdp: t.sdp });
                    }
                }
            }

            //
            // Resolve paused peers
            //

            let pausedTransports: { pid: number, id: string }[] = [];
            for (let t of tasks) {
                if (t.type === 'remove') {
                    let transportId = await this.repo.getProducerTransport(ctx, cid, t.pid, session);
                    if (transportId) {
                        pausedTransports.push({ pid: t.pid, id: transportId });
                    }
                }
            }

            return { workerId, routerId, addedTransports, pausedTransports, offers, session };
        });

        // No operations needed
        if (!def) {
            return;
        }

        // Get router if needed
        let router = await service.getOrCreateRouter(def.workerId, def.routerId);

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
            for (let answer of answers) {
                this.repo.answerProducerEndStream(ctx, answer.pid, answer.id, answer.sdp);
                Modules.Calls.repo.notifyPeerChanged(ctx, answer.pid);
            }
        });
    }
}