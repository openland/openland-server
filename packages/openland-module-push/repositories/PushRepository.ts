import { AllEntities } from 'openland-module-db/schema';
import { inTx } from 'foundation-orm/inTx';

export class PushRepository {
    private readonly entites: AllEntities;

    constructor(entites: AllEntities) {
        this.entites = entites;
    }

    async getUserWebPushTokens(uid: number) {
        return (await this.entites.PushWeb.allFromUser(uid)).filter((v) => v.enabled);
    }

    async getUserAndroidPushTokens(uid: number) {
        return (await this.entites.PushFirebase.allFromUser(uid)).filter((v) => v.enabled);
    }

    async getUserApplePushTokens(uid: number) {
        return (await this.entites.PushApple.allFromUser(uid)).filter((v) => v.enabled);
    }

    async registerPushApple(uid: number, tid: string, token: string, bundleId: string, sandbox: boolean) {
        await inTx(async () => {
            let existing = await this.entites.PushApple.findFromToken(token);
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

            await this.entites.PushApple.create(await this.entites.connection.nextRandomId(), { uid, tid, token, bundleId, sandbox, enabled: true });
        });
    }

    async registerPushAndroid(uid: number, tid: string, token: string, packageId: string, sandbox: boolean) {
        await inTx(async () => {
            let existing = await this.entites.PushFirebase.findFromToken(token);
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
            await this.entites.PushFirebase.create(await this.entites.connection.nextRandomId(), { uid, tid, token, packageId, sandbox, enabled: true });
        });
    }

    async registerPushWeb(uid: number, tid: string, endpoint: string) {
        await inTx(async () => {
            let existing = await this.entites.PushWeb.findFromEndpoint(endpoint);
            if (existing) {
                if (existing.uid === uid && existing.tid === tid) {
                    existing.endpoint = endpoint;
                    return;
                } else {
                    existing.enabled = false;
                    await existing.flush();
                }
            }
            await this.entites.PushWeb.create(await this.entites.connection.nextRandomId(), { uid, tid, endpoint, enabled: true });
        });
    }

}