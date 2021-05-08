import { inTx } from '@openland/foundationdb';
import { CallSchedulerKitchenTransport } from './CallSchedulerKitchenTransport';
import { createLogger } from '@openland/log';
import { CallRepository } from './CallRepository';
import { Store } from 'openland-module-db/FDB';
import { MediaKitchenRepository } from '../kitchen/MediaKitchenRepository';
import { Context } from '@openland/context';
import { CallScheduler, MediaSources, StreamHint, Capabilities } from './CallScheduler';
import { injectable } from 'inversify';
import { lazyInject } from 'openland-modules/Modules.container';

const logger = createLogger('mediakitchen');

@injectable()
export class CallSchedulerKitchen implements CallScheduler {

    @lazyInject('CallRepository')
    readonly callRepo!: CallRepository;

    @lazyInject('MediaKitchenRepository')
    readonly repo!: MediaKitchenRepository;

    @lazyInject('CallSchedulerKitchenTransport')
    readonly transport!: CallSchedulerKitchenTransport;

    //
    // Peer Events
    //

    onPeerAdded = async (ctx: Context, cid: number, pid: number, sources: MediaSources, capabilities: Capabilities, role: 'speaker' | 'listener') => {

        logger.log(ctx, 'Add peer');

        // Resolve router
        let routerId: string;
        let router = await Store.ConferenceKitchenRouter.conference.find(ctx, cid);
        if (!router || router.deleted) {
            routerId = await this.repo.createRouter(ctx, ctx.req.ip ? ctx.req.ip : undefined);
            await Store.ConferenceKitchenRouter.create(ctx, routerId, { cid, deleted: false });
        } else {
            routerId = router.id;
        }

        // Create peer
        let existing = await Store.ConferenceKitchenPeer.conferenceProducers.findAll(ctx, cid);
        let producerTransport = role === 'speaker' ? await this.transport.createProducerTransport(ctx, routerId, cid, pid, sources, capabilities) : null;
        let consumerTransport = await this.transport.createConsumerTransport(ctx, routerId, cid, pid, existing.filter((v) => !!v.producerTransport).map((v) => v.producerTransport!), capabilities);
        await Store.ConferenceKitchenPeer.create(ctx, pid, {
            cid,
            capabilities,
            producerTransport,
            consumerTransport,
            sources,
            active: true
        });

        // Update stats
        Store.ConferenceKitchenPeersCount.increment(ctx, routerId);
        if (producerTransport) {
            Store.ConferenceKitchenTransportsCount.increment(ctx, routerId);
            Store.ConferenceKitchenProducersCount.increment(ctx, routerId);
        }
        if (consumerTransport) {
            Store.ConferenceKitchenTransportsCount.increment(ctx, routerId);
            Store.ConferenceKitchenConsumersCount.increment(ctx, routerId);
        }

        // Connect producers
        if (producerTransport) {
            let peerConsumers = (await Store.ConferenceKitchenPeer.conference.findAll(ctx, cid));
            for (let peer of peerConsumers) {
                if (peer.pid === pid) {
                    continue;
                }
                if (!peer.active) {
                    continue;
                }
                if (!peer.consumerTransport) {
                    continue;
                }

                // Add producer to consumer
                let ct = (await Store.ConferenceKitchenConsumerTransport.findById(ctx, peer.consumerTransport))!;
                if (ct.consumes.find((c) => c === producerTransport)) {
                    continue;
                }
                await this.transport.updateConsumerTransport(ctx, peer.consumerTransport, [...ct.consumes, producerTransport!]);
                this.callRepo.notifyPeerChanged(ctx, ct.pid);
            }
        }
    }

    onPeerStreamsChanged = async (parent: Context, cid: number, pid: number, sources: MediaSources) => {
        await inTx(parent, async (ctx) => {
            let peer = await Store.ConferenceKitchenPeer.findById(ctx, pid);
            if (!peer || !peer.active) {
                return;
            }
            peer.sources = sources;
            await peer.flush(ctx);
            if (peer.producerTransport) {
                await this.transport.updateProducerTransport(ctx, peer.producerTransport, sources);
                this.callRepo.notifyPeerChanged(ctx, pid);
            }
        });
    }

    onPeerRemoved = async (parent: Context, cid: number, pid: number) => {
        await inTx(parent, async (ctx) => {
            logger.log(ctx, 'Remove peer');
            let peer = await Store.ConferenceKitchenPeer.findById(ctx, pid);
            if (!peer || !peer.active) {
                return;
            }
            let router = await Store.ConferenceKitchenRouter.conference.find(ctx, cid);
            if (!router || router.deleted) {
                return;
            }
            Store.ConferenceKitchenPeersCount.decrement(ctx, router.id);
            if (peer.producerTransport) {
                await this.transport.removeProducerTransport(ctx, peer.producerTransport);
                Store.ConferenceKitchenTransportsCount.decrement(ctx, router.id);
                Store.ConferenceKitchenProducersCount.decrement(ctx, router.id);
            }
            if (peer.consumerTransport) {
                await this.transport.removeConsumerTransport(ctx, peer.consumerTransport);
                Store.ConferenceKitchenTransportsCount.decrement(ctx, router.id);
                Store.ConferenceKitchenConsumersCount.decrement(ctx, router.id);
            }
            peer.active = false;
            await peer.flush(ctx);

            // Delete router on last peer removed
            if (await Store.ConferenceKitchenPeersCount.get(ctx, router.id) === 0) {
                router.deleted = true;
                await router.flush(ctx);
                await this.repo.deleteRouter(ctx, router.id);
            }
        });
    }

    onPeerRoleChanged = async (parent: Context, cid: number, pid: number, role: 'speaker' | 'listener') => {
        await inTx(parent, async (ctx) => {
            const peer = await Store.ConferenceKitchenPeer.findById(ctx, pid);
            if (!peer || !peer.active) {
                return false;
            }
            const router = await Store.ConferenceKitchenRouter.conference.find(ctx, cid);
            if (!router || router.deleted) {
                return false;
            }

            if (role === 'speaker') {
                if (!peer.producerTransport) {

                    // Create new producer
                    const producer = await this.transport.createProducerTransport(ctx, router.id, cid, pid, peer.sources, peer.capabilities!);
                    peer.producerTransport = producer;
                    await peer.flush(ctx);
                    this.callRepo.notifyPeerChanged(ctx, pid);

                    // Update counters
                    Store.ConferenceKitchenTransportsCount.increment(ctx, router.id);
                    Store.ConferenceKitchenProducersCount.increment(ctx, router.id);
                }

                // Connect
                let peerConsumers = (await Store.ConferenceKitchenPeer.conference.findAll(ctx, cid));
                for (let cosumerPeer of peerConsumers) {
                    if (cosumerPeer.pid === pid) {
                        continue;
                    }
                    if (!cosumerPeer.active) {
                        continue;
                    }
                    if (!cosumerPeer.consumerTransport) {
                        continue;
                    }

                    // Add producer to consumer
                    let ct = (await Store.ConferenceKitchenConsumerTransport.findById(ctx, cosumerPeer.consumerTransport))!;
                    if (ct.consumes.find((c) => c === peer.producerTransport)) {
                        continue;
                    }
                    await this.transport.updateConsumerTransport(ctx, cosumerPeer.consumerTransport, [...ct.consumes, peer.producerTransport!]);
                    this.callRepo.notifyPeerChanged(ctx, ct.pid);
                }
            }

            return !!peer.producerTransport;
        });
    }

    //
    // Events
    //

    onStreamFailed = async (ctx: Context, cid: number, pid: number, sid: string) => {
        // TODO: Implement
    }

    onStreamOffer = async (parent: Context, cid: number, pid: number, sid: string, offer: string, hints: StreamHint[] | null) => {
        await inTx(parent, async (ctx) => {
            await this.transport.onWebRTCConnectionOffer(ctx, sid, offer, hints);
        });
    }

    onStreamAnswer = async (parent: Context, cid: number, pid: number, sid: string, answer: string) => {
        await inTx(parent, async (ctx) => {
            await this.transport.onWebRTCConnectionAnswer(ctx, sid, answer);
        });
    }

    onStreamCandidate = async (ctx: Context, cid: number, pid: number, sid: string, candidate: string) => {
        // Ignore
    }

    onTransportCreated = async (ctx: Context, transportId: string) => {
        await this.transport.onKitchenTransportCreated(ctx, transportId);
    }

    onTransportConnected = async (ctx: Context, transportId: string) => {
        await this.transport.onKitchenTransportCreated(ctx, transportId);
    }

    onProducerCreated = async (ctx: Context, transportId: string, producerId: string) => {
        await this.transport.onKitchenProducerCreated(ctx, transportId, producerId);
    }

    onConsumerCreated = async (ctx: Context, transportId: string, consumerId: string) => {
        await this.transport.onKitchenConsumerCreated(ctx, transportId, consumerId);
    }
}