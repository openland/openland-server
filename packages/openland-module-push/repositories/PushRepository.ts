import { Store } from './../../openland-module-db/store';
import { inTx } from '@openland/foundationdb';
import { Context } from '@openland/context';
import { RandomLayer } from '@openland/foundationdb-random';

export class PushRepository {
    private readonly entites: Store;
    private readonly random: RandomLayer;

    constructor(entites: Store) {
        this.entites = entites;
        this.random = entites.storage.db.get(RandomLayer);
    }

    async getAndroidToken(ctx: Context, id: string) {
        return await this.entites.PushFirebase.findById(ctx, id);
    }

    async getAppleToken(ctx: Context, id: string) {
        return await this.entites.PushApple.findById(ctx, id);
    }

    async getWebToken(ctx: Context, id: string) {
        return await this.entites.PushWeb.findById(ctx, id);
    }

    async getSafariToken(ctx: Context, id: string) {
        return await this.entites.PushSafari.findById(ctx, id);
    }

    async getUserWebPushTokens(ctx: Context, uid: number) {
        return (await this.entites.PushWeb.user.findAll(ctx, uid)).filter((v) => v.enabled);
    }

    async getUserAndroidPushTokens(ctx: Context, uid: number) {
        return (await this.entites.PushFirebase.user.findAll(ctx, uid)).filter((v) => v.enabled);
    }

    async getUserApplePushTokens(ctx: Context, uid: number) {
        return (await this.entites.PushApple.user.findAll(ctx, uid)).filter((v) => v.enabled);
    }

    async getUserSafariPushTokens(ctx: Context, uid: number) {
        return (await this.entites.PushSafari.user.findAll(ctx, uid)).filter((v) => v.enabled);
    }

    async registerPushApple(parent: Context, uid: number, tid: string, token: string, bundleId: string, sandbox: boolean) {
        await inTx(parent, async (ctx) => {
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
        });
    }

    async registerPushAndroid(parent: Context, uid: number, tid: string, token: string, packageId: string, sandbox: boolean) {
        await inTx(parent, async (ctx) => {
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
        });
    }

    async registerPushWeb(parent: Context, uid: number, tid: string, endpoint: string) {
        await inTx(parent, async (ctx) => {
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
        });
    }

    async registerPushSafari(parent: Context, uid: number, tid: string, token: string, bundleId: string) {
        await inTx(parent, async (ctx) => {
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
        });
    }

    async disablePushSafari(parent: Context, token: string, bundleId: string) {
        await inTx(parent, async (ctx) => {
            let existing = await this.entites.PushSafari.token.find(ctx, token);
            if (existing) {
                existing.enabled = false;
            }
        });
    }

    async disablePushForToken(parent: Context, uid: number, tid: string) {
        await inTx(parent, async (ctx) => {
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
        });
    }
}