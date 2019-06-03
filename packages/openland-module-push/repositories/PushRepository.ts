import { AllEntities } from 'openland-module-db/schema';
import { inTx } from 'foundation-orm/inTx';
import { Context } from '@openland/context';

export class PushRepository {
    private readonly entites: AllEntities;

    constructor(entites: AllEntities) {
        this.entites = entites;
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
        return (await this.entites.PushWeb.allFromUser(ctx, uid)).filter((v) => v.enabled);
    }

    async getUserAndroidPushTokens(ctx: Context, uid: number) {
        return (await this.entites.PushFirebase.allFromUser(ctx, uid)).filter((v) => v.enabled);
    }

    async getUserApplePushTokens(ctx: Context, uid: number) {
        return (await this.entites.PushApple.allFromUser(ctx, uid)).filter((v) => v.enabled);
    }

    async getUserSafariPushTokens(ctx: Context, uid: number) {
        return (await this.entites.PushSafari.allFromUser(ctx, uid)).filter((v) => v.enabled);
    }

    async registerPushApple(parent: Context, uid: number, tid: string, token: string, bundleId: string, sandbox: boolean) {
        await inTx(parent, async (ctx) => {
            let existing = await this.entites.PushApple.findFromToken(ctx, token);
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

            await this.entites.PushApple.create(ctx, await this.entites.connection.nextRandomId(), { uid, tid, token, bundleId, sandbox, enabled: true });
        });
    }

    async registerPushAndroid(parent: Context, uid: number, tid: string, token: string, packageId: string, sandbox: boolean) {
        await inTx(parent, async (ctx) => {
            let existing = await this.entites.PushFirebase.findFromToken(ctx, token);
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
            await this.entites.PushFirebase.create(ctx, await this.entites.connection.nextRandomId(), { uid, tid, token, packageId, sandbox, enabled: true });
        });
    }

    async registerPushWeb(parent: Context, uid: number, tid: string, endpoint: string) {
        await inTx(parent, async (ctx) => {
            let existing = await this.entites.PushWeb.findFromEndpoint(ctx, endpoint);
            if (existing) {
                if (existing.uid === uid && existing.tid === tid) {
                    existing.endpoint = endpoint;
                    return;
                } else {
                    existing.enabled = false;
                    await existing.flush(ctx);
                }
            }
            await this.entites.PushWeb.create(ctx, await this.entites.connection.nextRandomId(), { uid, tid, endpoint, enabled: true });
        });
    }

    async registerPushSafari(parent: Context, uid: number, tid: string, token: string, bundleId: string) {
        await inTx(parent, async (ctx) => {
            let existing = await this.entites.PushSafari.findFromToken(ctx, token);
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
            await this.entites.PushSafari.create(ctx, await this.entites.connection.nextRandomId(), { uid, tid, token, bundleId, enabled: true });
        });
    }

    async disablePushSafari(parent: Context, token: string, bundleId: string) {
        await inTx(parent, async (ctx) => {
            let existing = await this.entites.PushSafari.findFromToken(ctx, token);
            if (existing) {
                existing.enabled = false;
            }
        });
    }
}