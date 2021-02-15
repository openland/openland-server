import { Store } from './../../openland-module-db/store';
import { transactional } from '@openland/foundationdb';
import { Context } from '@openland/context';
import { RandomLayer } from '@openland/foundationdb-random';

export class PushRepository {
    private readonly entites: Store;
    private readonly random: RandomLayer;

    constructor(entites: Store) {
        this.entites = entites;
        this.random = entites.storage.db.get(RandomLayer);
    }

    @transactional
    async getAndroidToken(ctx: Context, id: string) {
        return await this.entites.PushFirebase.findById(ctx, id);
    }

    @transactional
    async getAppleToken(ctx: Context, id: string) {
        return await this.entites.PushApple.findById(ctx, id);
    }

    @transactional
    async getWebToken(ctx: Context, id: string) {
        return await this.entites.PushWeb.findById(ctx, id);
    }

    @transactional
    async getSafariToken(ctx: Context, id: string) {
        return await this.entites.PushSafari.findById(ctx, id);
    }

    @transactional
    async getUserWebPushTokens(ctx: Context, uid: number) {
        return (await this.entites.PushWeb.user.findAll(ctx, uid)).filter((v) => v.enabled);
    }

    @transactional
    async getUserAndroidPushTokens(ctx: Context, uid: number) {
        return (await this.entites.PushFirebase.user.findAll(ctx, uid)).filter((v) => v.enabled);
    }

    @transactional
    async getUserApplePushTokens(ctx: Context, uid: number) {
        return (await this.entites.PushApple.user.findAll(ctx, uid)).filter((v) => v.enabled);
    }

    @transactional
    async getUserSafariPushTokens(ctx: Context, uid: number) {
        return (await this.entites.PushSafari.user.findAll(ctx, uid)).filter((v) => v.enabled);
    }

    @transactional
    async registerPushApple(ctx: Context, uid: number, tid: string, token: string, bundleId: string, sandbox: boolean) {
        let existing = await this.entites.PushApple.token.find(ctx, token);
        if (existing) {
            if (existing.uid === uid && existing.tid === tid) {
                existing.bundleId = bundleId;
                existing.sandbox = sandbox;
                return;
            } else {
                existing.enabled = false;
                await existing.flush(ctx);
            }
        }

        await this.entites.PushApple.create(ctx, this.random.nextRandomId(), { uid, tid, token, bundleId, sandbox, enabled: true, failedFirstAt: null, failedLastAt: null, failures: null, disabledAt: null });
    }

    @transactional
    async registerPushAndroid(ctx: Context, uid: number, tid: string, token: string, packageId: string, sandbox: boolean) {
        let existing = await this.entites.PushFirebase.token.find(ctx, token);
        if (existing) {
            if (existing.uid === uid && existing.tid === tid) {
                existing.packageId = packageId;
                existing.sandbox = sandbox;
                return;
            } else {
                existing.enabled = false;
                await existing.flush(ctx);
            }
        }
        await this.entites.PushFirebase.create(ctx, this.random.nextRandomId(), { uid, tid, token, packageId, sandbox, enabled: true, failedFirstAt: null, failedLastAt: null, failures: null, disabledAt: null });
    }

    @transactional
    async registerPushWeb(ctx: Context, uid: number, tid: string, endpoint: string) {
        let existing = await this.entites.PushWeb.endpoint.find(ctx, endpoint);
        if (existing) {
            if (existing.uid === uid && existing.tid === tid) {
                existing.endpoint = endpoint;
                return;
            } else {
                existing.enabled = false;
                await existing.flush(ctx);
            }
        }
        await this.entites.PushWeb.create(ctx, this.random.nextRandomId(), { uid, tid, endpoint, enabled: true, failedFirstAt: null, failedLastAt: null, failures: null, disabledAt: null });
    }

    @transactional
    async registerPushSafari(ctx: Context, uid: number, tid: string, token: string, bundleId: string) {
        let existing = await this.entites.PushSafari.token.find(ctx, token);
        if (existing) {
            if (existing.uid === uid && existing.tid === tid) {
                existing.bundleId = bundleId;
                existing.token = token;
                return;
            } else {
                existing.enabled = false;
                await existing.flush(ctx);
            }
        }
        await this.entites.PushSafari.create(ctx, this.random.nextRandomId(), { uid, tid, token, bundleId, enabled: true, failedFirstAt: null, failedLastAt: null, failures: null, disabledAt: null });
    }

    @transactional
    async disablePushSafari(ctx: Context, token: string, bundleId: string) {
        let existing = await this.entites.PushSafari.token.find(ctx, token);
        if (existing) {
            existing.enabled = false;
        }
    }

    @transactional
    async disablePushForToken(ctx: Context, uid: number, tid: string) {
        let [
            apple,
            firebase,
            safari,
            web
        ] = await Promise.all([
            this.entites.PushApple.user.findAll(ctx, uid),
            this.entites.PushFirebase.user.findAll(ctx, uid),
            this.entites.PushSafari.user.findAll(ctx, uid),
            this.entites.PushWeb.user.findAll(ctx, uid),
        ]);

        for (let push of [...apple, ...firebase, ...safari, ...web]) {
            if (push.tid === tid) {
                push.enabled = false;
            }
        }
    }
}