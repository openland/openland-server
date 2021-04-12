import { geoIP } from 'openland-utils/geoIP';
import { KitchenProducerParams, KitchenConsumerParams } from './types';
import { lazyInject } from 'openland-modules/Modules.container';
import { CallSchedulerKitchen } from '../repositories/CallSchedulerKitchen';
import { createLogger } from '@openland/log';
import { Store } from 'openland-module-db/FDB';
import { inTx } from '@openland/foundationdb';
import { Context } from '@openland/context';
import { injectable } from 'inversify';
import { Worker } from 'mediakitchen';
import uuid from 'uuid/v4';
import { convertRtpCapabilitiesToStore, convertRtpParamsToStore } from 'openland-module-calls/kitchen/convert';
import { pickClosest } from 'openland-utils/geo';
import { BetterWorkerQueue } from 'openland-module-workers/BetterWorkerQueue';

const logger = createLogger('mediakitchen');

@injectable()
export class MediaKitchenRepository {

    // Router tasks
    readonly routerCreateQueue = new BetterWorkerQueue<{ id: string, ip: string | undefined }>(Store.KitchenRouterCreateQueue, { maxAttempts: 'infinite', type: 'external' });
    readonly routerDeleteQueue = new BetterWorkerQueue<{ id: string }>(Store.KitchenRouterDeleteQueue, { maxAttempts: 'infinite', type: 'external' });

    // Transport tasks
    readonly transportCreateQueue = new BetterWorkerQueue<{ id: string }>(Store.KitchenTransportCreateQueue, { maxAttempts: 'infinite', type: 'external' });
    readonly transportConnectQueue = new BetterWorkerQueue<{ id: string }>(Store.KitchenTransportConnectQueue, { maxAttempts: 'infinite', type: 'external' });
    readonly transportDeleteQueue = new BetterWorkerQueue<{ id: string }>(Store.KitchenTransportDeleteQueue, { maxAttempts: 'infinite', type: 'external' });

    // Producer tasks
    readonly producerCreateQueue = new BetterWorkerQueue<{ id: string }>(Store.KitchenProducerCreateQueue, { maxAttempts: 'infinite', type: 'external' });
    readonly producerDeleteQueue = new BetterWorkerQueue<{ id: string }>(Store.KitchenProducerDeleteQueue, { maxAttempts: 'infinite', type: 'external' });

    // Consumer tasks
    readonly consumerCreateQueue = new BetterWorkerQueue<{ id: string }>(Store.KitchenConsumerCreateQueue, { maxAttempts: 'infinite', type: 'external' });
    readonly consumerUnpauseQueue = new BetterWorkerQueue<{ id: string }>(Store.KitchenConsumerUnpauseQueue, { maxAttempts: 'infinite', type: 'external' });
    readonly consumerDeleteQueue = new BetterWorkerQueue<{ id: string }>(Store.KitchenConsumerDeleteQueue, { maxAttempts: 'infinite', type: 'external' });

    @lazyInject('CallSchedulerKitchen')
    readonly scheduler!: CallSchedulerKitchen;

    //
    // Workers
    //

    async onWorkersChanged(parent: Context, workers: Worker[]) {

        // Remove unhealthy
        let allActive = await inTx(parent, async (ctx) => {
            return await Store.KitchenWorker.active.findAll(ctx);
        });

        // Find removed
        for (let w of allActive) {
            let existing = workers.find((v) => v.id === w.id && v.status === 'healthy');
            if (existing) {
                continue;
            } else {
                await this.onWorkerRemoved(parent, w.id);
            }
        }

        // Add healthy
        for (let w of workers) {
            if (w.status !== 'healthy') {
                continue;
            }
            await inTx(parent, async (ctx) => {
                // Find added and deleted
                let existing = await Store.KitchenWorker.findById(ctx, w.id);
                if (existing) {
                    // Kill if already deleted
                    if (existing.deleted) {
                        try {
                            w.kill();
                        } catch (e) {
                            logger.warn(ctx, e);
                            return;
                        }
                    }
                } else {
                    await this.onWorkerAdded(ctx, w.id, w.appData);
                }
            });
        }
    }

    async onWorkerRemoved(parent: Context, id: string) {
        await inTx(parent, async (ctx) => {
            logger.log(ctx, 'Worker unregistered: ' + id);

            // Unregister worker
            let ex = await Store.KitchenWorker.findById(ctx, id);
            if (!ex || ex.deleted) {
                throw Error('Internal error');
            }
            ex.deleted = true;
            await ex.flush(ctx);

            // Remove routers
            let routers = await Store.KitchenRouter.workerActive.findAll(ctx, id);
            for (let r of routers) {
                if (r.state !== 'deleted' && r.state !== 'deleting') {

                    // Fast delete of a router
                    r.state = 'deleted';
                    await r.flush(ctx);

                    // Handle event
                    await this.onRouterRemoving(ctx, r.id);
                    await this.onRouterRemoved(ctx, r.id);

                    // TODO: Notify scheduler or recreate router?
                }
            }
        });
    }

    async onWorkerAdded(parent: Context, id: string, appData: any) {
        await inTx(parent, async (ctx) => {
            logger.log(ctx, 'Worker registered: ' + id);

            // Register worker
            await Store.KitchenWorker.create(ctx, id, { deleted: false, appData });
        });
    }

    async pickWorker(parent: Context, ip: string | undefined) {
        return await inTx(parent, async (ctx) => {
            let active = await Store.KitchenWorker.active.findAll(ctx);
            if (active.length === 0) {
                throw Error('No workers available');
            }

            // Resolve location
            let requestLocation = { lat: 37.773972, long: -122.431297 }; // Default is SF
            if (ip) {
                let geo = geoIP(ip);
                if (geo.coordinates) {
                    requestLocation = geo.coordinates;
                }
            }

            // Resolve Closest Worker
            let nearest = pickClosest({
                location: requestLocation,
                data: active,
                ipExtractor: (src) => src.appData.ip,
                tolerance: 10
            });

            return nearest.id;
        });
    }

    //
    // Routers
    //

    async createRouter(parent: Context, ip: string | undefined) {
        return await inTx(parent, async (ctx) => {
            let id = uuid();
            await Store.KitchenRouter.create(ctx, id, {
                state: 'creating'
            });
            await this.onRouterCreating(ctx, id);
            this.routerCreateQueue.pushWork(ctx, { id, ip });
            return id;
        });
    }

    async deleteRouter(parent: Context, id: string) {
        await inTx(parent, async (ctx) => {
            let router = await Store.KitchenRouter.findById(ctx, id);
            if (!router) {
                throw Error('Unable to find router');
            }
            if (router.state === 'deleting' || router.state === 'deleted') {
                return;
            }
            router.state = 'deleting';
            await router.flush(ctx);
            await this.onRouterRemoving(ctx, id);
            this.routerDeleteQueue.pushWork(ctx, { id });
        });
    }

    //
    // Transports
    //

    async createTransport(parent: Context, id: string, routerId: string) {
        return await inTx(parent, async (ctx) => {
            let router = await Store.KitchenRouter.findById(ctx, routerId);
            if (!router) {
                throw Error('Unable to find router');
            }
            if (router.state === 'deleting' || router.state === 'deleted') {
                throw Error('Router is being deleted');
            }
            await Store.KitchenTransport.create(ctx, id, {
                routerId,
                state: 'creating'
            });
            await this.onTransportCreating(ctx, id);
            if (router.state !== 'creating') {
                this.transportCreateQueue.pushWork(ctx, { id });
            } else {
                logger.log(ctx, 'Not scheduling transport creation: ' + id);
            }
            return id;
        });
    }

    async connectTransport(parent: Context, transportId: string, dtlsRole: 'server' | 'client', fingerprints: { algorithm: string, value: string }[]) {
        return await inTx(parent, async (ctx) => {
            let transport = await Store.KitchenTransport.findById(ctx, transportId);
            if (!transport) {
                throw Error('Unable to find transport');
            }
            if (transport.clientParameters || !(transport.state === 'created' || transport.state === 'creating')) {
                return;
            }
            transport.clientParameters = { fingerprints, dtlsRole };

            // Connect Transport if created
            if (transport.state === 'created') {
                transport.state = 'connecting';
                this.transportConnectQueue.pushWork(ctx, { id: transportId });
            }

            await transport.flush(ctx);
        });
    }

    async deleteTransport(parent: Context, transportId: string) {
        return await inTx(parent, async (ctx) => {
            let transport = await Store.KitchenTransport.findById(ctx, transportId);
            if (!transport) {
                throw Error('Unable to find transport');
            }
            if (transport.state === 'deleted' || transport.state === 'deleting') {
                return;
            }
            transport.state = 'deleting';
            await transport.flush(ctx);
            await this.onTransportRemoving(ctx, transportId);
            this.transportDeleteQueue.pushWork(ctx, { id: transportId });
        });
    }

    //
    // Producer
    //

    async createProducer(parent: Context,
        transportId: string,
        parameters: KitchenProducerParams
    ) {
        return await inTx(parent, async (ctx) => {
            let transport = await Store.KitchenTransport.findById(ctx, transportId);
            if (!transport) {
                throw Error('Unable to find transport');
            }
            if (transport.state === 'deleted' || transport.state === 'deleting') {
                throw Error('Transport is being deleted');
            }
            let id = uuid();
            await Store.KitchenProducer.create(ctx, id, {
                routerId: transport.routerId,
                transportId: transport.id,
                state: 'creating',
                paused: false,
                parameters: {
                    kind: parameters.kind,
                    rtpParameters: convertRtpParamsToStore(parameters.rtpParameters),
                    paused: parameters.paused,
                    keyFrameRequestDelay: parameters.keyFrameRequestDelay
                }
            });
            await this.onProducerCreating(ctx, transport.id, id);
            if (transport.state !== 'creating') {
                this.producerCreateQueue.pushWork(ctx, { id });
            }
            return id;
        });
    }

    async deleteProducer(parent: Context, producerId: string) {
        return await inTx(parent, async (ctx) => {
            let producer = await Store.KitchenProducer.findById(ctx, producerId);
            if (!producer) {
                throw Error('Unable to find producer');
            }
            if (producer.state === 'deleted' || producer.state === 'deleting') {
                return;
            }
            producer.state = 'deleting';
            await this.onProducerRemoving(ctx, producer.transportId, producerId);
            this.producerDeleteQueue.pushWork(ctx, { id: producerId });
        });
    }

    //
    // Consumers
    //

    async createConsumer(parent: Context, transportId: string, producerId: string, params: KitchenConsumerParams) {
        return await inTx(parent, async (ctx) => {
            let transport = await Store.KitchenTransport.findById(ctx, transportId);
            if (!transport) {
                throw Error('Unable to find transport');
            }
            if (transport.state === 'deleted' || transport.state === 'deleting') {
                throw Error('Transport is being deleted');
            }
            let producer = await Store.KitchenProducer.findById(ctx, producerId);
            if (!producer) {
                throw Error('Unable to find producer');
            }
            if (producer.state === 'deleting' || producer.state === 'deleted') {
                throw Error('Producer already deleted');
            }
            let id = uuid();
            await Store.KitchenConsumer.create(ctx, id, {
                routerId: transport.routerId,
                producerId,
                transportId,
                state: 'creating',
                paused: false,
                parameters: {
                    rtpCapabilities: params.rtpCapabilities ? convertRtpCapabilitiesToStore(params.rtpCapabilities) : null,
                    preferredLayers: params.preferredLayers ? {
                        spatialLayer: params.preferredLayers.spatialLayer,
                        temporalLayer: params.preferredLayers.temporalLayer
                    } : null,
                    paused: params.paused
                }
            });
            await this.onConsumerCreating(ctx, transportId, id);
            if (producer.state !== 'creating' && transport.state !== 'creating') {
                this.consumerCreateQueue.pushWork(ctx, { id });
            }
            return id;
        });
    }

    async unpauseConsumer(parent: Context, consumerId: string) {
        return await inTx(parent, async (ctx) => {
            let consumer = await Store.KitchenConsumer.findById(ctx, consumerId);
            if (!consumer) {
                throw Error('Unable to find consumer');
            }
            if (consumer.state === 'creating') {
                throw Error('Unable unpause during creating');
            }
            if (consumer.state === 'deleted' || consumer.state === 'deleting') {
                return;
            }
            this.consumerUnpauseQueue.pushWork(ctx, { id: consumerId });
        });
    }

    async deleteConsumer(parent: Context, consumerId: string) {
        return await inTx(parent, async (ctx) => {
            let consumer = await Store.KitchenConsumer.findById(ctx, consumerId);
            if (!consumer) {
                throw Error('Unable to find consumer');
            }
            if (consumer.state === 'deleted' || consumer.state === 'deleting') {
                return;
            }
            await this.onConsumerRemoving(ctx, consumer.transportId, consumerId);
            this.consumerDeleteQueue.pushWork(ctx, { id: consumerId });
        });
    }

    //
    // Router Events
    //

    async onRouterCreating(parent: Context, id: string) {
        await inTx(parent, async (ctx) => {
            logger.log(ctx, 'Creating router: ' + id);
        });
    }

    async onRouterCreated(parent: Context, id: string) {
        await inTx(parent, async (ctx) => {
            logger.log(ctx, 'Created router: ' + id);

            // Create transports
            let transports = await Store.KitchenTransport.routerActive.findAll(ctx, id);
            for (let t of transports) {
                logger.log(ctx, 'Transport: ' + t.id);
                if (t.state === 'creating') {
                    logger.log(ctx, 'Scheduling transport creation: ' + t.id);
                    this.transportCreateQueue.pushWork(ctx, { id: t.id });
                }
            }
        });
    }

    async onRouterRemoving(parent: Context, id: string) {
        await inTx(parent, async (ctx) => {
            logger.log(ctx, 'Removing router: ' + id);

            // Remove transports
            let transports = await Store.KitchenTransport.routerActive.findAll(ctx, id);
            for (let t of transports) {
                if (t.state === 'deleting') {
                    t.state = 'deleted';
                    await t.flush(ctx);
                    await this.onTransportRemoved(ctx, t.id);
                } else {
                    t.state = 'deleted';
                    await t.flush(ctx);
                    await this.onTransportRemoving(ctx, t.id);
                    await this.onTransportRemoved(ctx, t.id);
                }
            }
        });
    }

    async onRouterRemoved(parent: Context, id: string) {
        await inTx(parent, async (ctx) => {
            logger.log(ctx, 'Removed router: ' + id);
        });
    }

    //
    // Transport Events
    //

    async onTransportCreating(parent: Context, id: string) {
        await inTx(parent, async (ctx) => {
            logger.log(ctx, 'Creating transport: ' + id);
        });
    }

    async onTransportCreated(parent: Context, id: string) {
        await inTx(parent, async (ctx) => {
            logger.log(ctx, 'Created transport: ' + id);
            let transport = await Store.KitchenTransport.findById(ctx, id);
            if (!transport) {
                return;
            }

            // Notify scheduler
            await this.scheduler.onTransportCreated(ctx, id);

            // Connect if already have client parameters
            if (transport.clientParameters) {
                transport.state = 'connecting';
                this.transportConnectQueue.pushWork(ctx, { id });
            }

            // Create producers
            let producers = await Store.KitchenProducer.transportActive.findAll(ctx, id);
            for (let p of producers) {
                if (p.state === 'creating') {
                    this.producerCreateQueue.pushWork(ctx, { id: p.id });
                }
            }

            // Create producers if producers are created
            let consumers = await Store.KitchenConsumer.transportActive.findAll(ctx, id);
            for (let p of consumers) {
                if (p.state === 'creating') {
                    let producer = (await Store.KitchenProducer.findById(ctx, p.producerId))!;
                    if (producer.state === 'created') {
                        this.consumerCreateQueue.pushWork(ctx, { id: p.id });
                    }
                }
            }
        });
    }

    async onTransportConnected(parent: Context, id: string) {
        await inTx(parent, async (ctx) => {
            logger.log(ctx, 'Connected transport: ' + id);
            let transport = await Store.KitchenTransport.findById(ctx, id);
            if (!transport) {
                return;
            }

            // Notify scheduler
            await this.scheduler.onTransportConnected(ctx, id);
        });
    }

    async onTransportRemoving(parent: Context, id: string) {
        await inTx(parent, async (ctx) => {
            logger.log(ctx, 'Removing transport: ' + id);

            // Remove producers
            let producers = await Store.KitchenProducer.transportActive.findAll(ctx, id);
            for (let p of producers) {
                if (p.state === 'deleting') {
                    p.state = 'deleted';
                    await p.flush(ctx);
                    await this.onProducerRemoved(ctx, id, p.id);
                } else {
                    p.state = 'deleted';
                    await p.flush(ctx);
                    await this.onProducerRemoving(ctx, id, p.id);
                    await this.onProducerRemoved(ctx, id, p.id);
                }
            }
        });
    }

    async onTransportRemoved(parent: Context, id: string) {
        await inTx(parent, async (ctx) => {
            logger.log(ctx, 'Removed transport: ' + id);
        });
    }

    //
    // Producer Events
    //

    async onProducerCreating(parent: Context, transportId: string, producerId: string) {
        await inTx(parent, async (ctx) => {
            logger.log(ctx, 'Creating producer: ' + producerId);
        });
    }

    async onProducerCreated(parent: Context, transportId: string, producerId: string) {
        await inTx(parent, async (ctx) => {
            logger.log(ctx, 'Created producer: ' + producerId);

            // Create dependent consumers
            let consumers = await Store.KitchenConsumer.producerActive.findAll(ctx, producerId);
            for (let c of consumers) {
                if (c.state === 'creating') {
                    let transport = (await Store.KitchenTransport.findById(ctx, c.transportId))!;
                    if (transport.state === 'created' || transport.state === 'connected' || transport.state === 'connecting') {
                        await this.consumerCreateQueue.pushWork(ctx, { id: c.id });
                    }
                }
            }

            // Notify scheduler
            await this.scheduler.onProducerCreated(ctx, transportId, producerId);
        });
    }

    async onProducerRemoving(parent: Context, transportId: string, id: string) {
        await inTx(parent, async (ctx) => {
            logger.log(ctx, 'Removing producer: ' + id);

            // Remove consumers
            let consumers = await Store.KitchenConsumer.producerActive.findAll(ctx, id);
            for (let c of consumers) {
                if (c.state === 'deleting') {
                    c.state = 'deleted';
                    await c.flush(ctx);
                    await this.onConsumerRemoved(ctx, transportId, c.id);
                } else {
                    c.state = 'deleted';
                    await c.flush(ctx);
                    await this.onConsumerRemoving(ctx, transportId, c.id);
                    await this.onConsumerRemoved(ctx, transportId, c.id);
                }
            }
        });
    }

    async onProducerRemoved(parent: Context, transportId: string, id: string) {
        await inTx(parent, async (ctx) => {
            logger.log(ctx, 'Removed producer: ' + id);
        });
    }

    //
    // Consumer Events
    //

    async onConsumerCreating(parent: Context, transportId: string, consumerId: string) {
        await inTx(parent, async (ctx) => {
            logger.log(ctx, 'Creating consumer: ' + transportId + '/' + consumerId);
        });
    }

    async onConsumerCreated(parent: Context, transportId: string, consumerId: string) {
        await inTx(parent, async (ctx) => {
            logger.log(ctx, 'Created consumer: ' + transportId + '/' + consumerId);

            // Notify scheduler
            await this.scheduler.onConsumerCreated(ctx, transportId, consumerId);
        });
    }

    async onConsumerRemoving(parent: Context, transportId: string, consumerId: string) {
        await inTx(parent, async (ctx) => {
            logger.log(ctx, 'Removing consumer: ' + consumerId);
        });
    }

    async onConsumerRemoved(parent: Context, transportId: string, consumerId: string) {
        await inTx(parent, async (ctx) => {
            logger.log(ctx, 'Removed consumer: ' + consumerId);
        });
    }

}