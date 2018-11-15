import { AllEntities } from 'openland-module-db/schema';
import { inTx } from 'foundation-orm/inTx';
import { Context } from 'openland-utils/Context';

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

    async getUserWebPushTokens(ctx: Context, uid: number) {
        return (await this.entites.PushWeb.allFromUser(ctx, uid)).filter((v) => v.enabled);
    }

    async getUserAndroidPushTokens(ctx: Context, uid: number) {
        return (await this.entites.PushFirebase.allFromUser(ctx, uid)).filter((v) => v.enabled);
    }

    async getUserApplePushTokens(ctx: Context, uid: number) {
        return (await this.entites.PushApple.allFromUser(ctx, uid)).filter((v) => v.enabled);
    }

    async registerPushApple(ctx: Context, uid: number, tid: string, token: string, bundleId: string, sandbox: boolean) {
        await inTx(async () => {
            let existing = await this.entites.PushApple.findFromToken(ctx, token);
            if (existing) {
                if (existing.uid === uid && existing.tid === tid) {
                    existing.bundleId = bundleId;
                    existing.sandbox = sandbox;
                    return;
                } else {
                    existing.enabled = false;
                    await existing.flush();
                }
            }

            await this.entites.PushApple.create(ctx, await this.entites.connection.nextRandomId(), { uid, tid, token, bundleId, sandbox, enabled: true });
        });
    }

    async registerPushAndroid(ctx: Context, uid: number, tid: string, token: string, packageId: string, sandbox: boolean) {
        await inTx(async () => {
            let existing = await this.entites.PushFirebase.findFromToken(ctx, token);
            if (existing) {
                if (existing.uid === uid && existing.tid === tid) {
                    existing.packageId = packageId;
                    existing.sandbox = sandbox;
                    return;
                } else {
                    existing.enabled = false;
                    await existing.flush();
                }
            }
            await this.entites.PushFirebase.create(ctx, await this.entites.connection.nextRandomId(), { uid, tid, token, packageId, sandbox, enabled: true });
        });
    }

    async registerPushWeb(ctx: Context, uid: number, tid: string, endpoint: string) {
        await inTx(async () => {
            let existing = await this.entites.PushWeb.findFromEndpoint(ctx, endpoint);
            if (existing) {
                if (existing.uid === uid && existing.tid === tid) {
                    existing.endpoint = endpoint;
                    return;
                } else {
                    existing.enabled = false;
                    await existing.flush();
                }
            }
            await this.entites.PushWeb.create(ctx, await this.entites.connection.nextRandomId(), { uid, tid, endpoint, enabled: true });
        });
    }

}