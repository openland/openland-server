import { lazyInject } from 'openland-modules/Modules.container';
import { CallSchedulerKitchen } from './CallSchedulerKitchen';
import { createLogger } from '@openland/log';
import { Store } from 'openland-module-db/FDB';
import { inTx } from '@openland/foundationdb';
import { Context } from '@openland/context';
import { WorkQueue } from 'openland-module-workers/WorkQueue';
import { injectable } from 'inversify';
import { Worker } from 'mediakitchen';
import { randomInt } from 'openland-utils/random';
import uuid from 'uuid/v4';

const logger = createLogger('mediakitchen');

export interface KitchenIceCandidate {
    foundation: string;
    priority: number;
    ip: string;
    protocol: 'tcp' | 'udp';
    port: number;
}

@injectable()
export class MediaKitchenRepository {

    // Router tasks
    readonly routerCreateQueue = new WorkQueue<{ id: string }, { result: boolean }>('kitchen-router-create', -1);
    readonly routerDeleteQueue = new WorkQueue<{ id: string }, { result: boolean }>('kitchen-router-delete', -1);

    // Transport tasks
    readonly transportCreateQueue = new WorkQueue<{ id: string }, { result: boolean }>('kitchen-transport-create', -1);
    readonly transportConnectQueue = new WorkQueue<{ id: string }, { result: boolean }>('kitchen-transport-connect', -1);
    readonly transportDeleteQueue = new WorkQueue<{ id: string }, { result: boolean }>('kitchen-transport-create', -1);

    @lazyInject('CallSchedulerKitchen')
    readonly scheduler!: CallSchedulerKitchen;

    //
    // Workers
    //

    async onWorkersChanged(parent: Context, workers: Worker[]) {
        await inTx(parent, async (ctx) => {
            let allActive = await Store.KitchenWorker.active.findAll(ctx);

            // Find removed
            for (let w of allActive) {
                let existing = workers.find((v) => v.id === w.id && v.status === 'healthy');
                if (existing) {
                    continue;
                } else {
                    await this.onWorkerRemoved(ctx, w.id);
                }
            }

            // Find added and deleted
            for (let w of workers) {
                if (w.status !== 'healthy') {
                    continue;
                }
                let existing = allActive.find((v) => v.id === w.id);
                if (existing) {
                    // Kill if already deleted
                    if (existing.deleted) {
                        w.kill();
                    }
                } else {
                    await this.onWorkerAdded(ctx, w.id);
                }
            }
        });
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

    async onWorkerAdded(parent: Context, id: string) {
        await inTx(parent, async (ctx) => {
            logger.log(ctx, 'Worker registered: ' + id);

            // Register worker
            await Store.KitchenWorker.create(ctx, id, { deleted: false });
        });
    }

    async pickWorker(parent: Context) {
        return await inTx(parent, async (ctx) => {
            let active = await Store.KitchenWorker.active.findAll(ctx);
            if (active.length === 0) {
                throw Error('No workers available');
            }
            let index = randomInt(0, active.length);
            return active[index].id;
        });
    }

    //
    // Routers
    //

    async createRouter(parent: Context) {
        return await inTx(parent, async (ctx) => {
            let id = uuid();
            await Store.KitchenRouter.create(ctx, id, {
                state: 'creating'
            });
            await this.onRouterCreating(ctx, id);
            await this.routerCreateQueue.pushWork(ctx, { id });
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
            await this.routerDeleteQueue.pushWork(ctx, { id });
        });
    }

    //
    // Transports
    //

    async createTransport(parent: Context, routerId: string) {
        return await inTx(parent, async (ctx) => {
            let router = await Store.KitchenRouter.findById(ctx, routerId);
            if (!router) {
                throw Error('Unable to find router');
            }
            if (router.state === 'deleting' || router.state === 'deleted') {
                throw Error('Router is being deleted');
            }
            let id = uuid();
            await Store.KitchenTransport.create(ctx, id, {
                routerId,
                state: 'creating'
            });
            await this.onTransportCreating(ctx, id);
            if (router.state === 'created') {
                await this.transportCreateQueue.pushWork(ctx, { id });
            }
            return id;
        });
    }

    async connectTransport(parent: Context, transportId: string, fingerprints: { algorithm: string, value: string }[]) {
        return await inTx(parent, async (ctx) => {
            let transport = await Store.KitchenTransport.findById(ctx, transportId);
            if (!transport) {
                throw Error('Unable to find transport');
            }
            if (transport.clientParameters || !(transport.state === 'created' || transport.state === 'creating')) {
                return;
            }
            transport.clientParameters = { fingerprints };

            // Connect Transport if created
            if (transport.state === 'created') {
                transport.state = 'connecting';
                await this.transportConnectQueue.pushWork(ctx, { id: transportId });
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
            await this.transportDeleteQueue.pushWork(ctx, { id: transportId });
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
                await this.transportCreateQueue.pushWork(ctx, { id: t.id });
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
                    await this.onTransportRemoved(ctx, id);
                } else {
                    t.state = 'deleted';
                    await t.flush(ctx);
                    await this.onTransportRemoving(ctx, id);
                    await this.onTransportRemoved(ctx, id);
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
                await this.transportConnectQueue.pushWork(ctx, { id });
            }
        });
    }

    async onTransportRemoving(parent: Context, id: string) {
        await inTx(parent, async (ctx) => {
            logger.log(ctx, 'Removing transport: ' + id);
        });
    }

    async onTransportRemoved(parent: Context, id: string) {
        await inTx(parent, async (ctx) => {
            logger.log(ctx, 'Removed transport: ' + id);
        });
    }
}