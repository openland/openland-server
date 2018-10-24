import { DB } from 'openland-server/tables';
import { UpdateReader } from 'openland-server/modules/updateReader';
import { inTx } from 'foundation-orm/inTx';
import { PushModule } from 'openland-module-push/PushModule';

export function startImporterWorker(module: PushModule) {
    let reader = new UpdateReader('push_export', 3, DB.UserPushRegistration);
    reader.processor(async (items) => {
        await inTx(async () => {
            for (let t of items) {
                let tid = (await DB.UserToken.findById(t.tokenId))!.uuid!;
                if (t.pushType === 'web-push') {
                    await module.registerPushWeb(t.userId, tid, t.pushEndpoint);
                } else if (t.pushType === 'android') {
                    let src = JSON.parse(t.pushEndpoint);
                    await module.registerPushAndroid(t.userId, tid, src.token, src.bundleId, src.sandbox);
                } else if (t.pushType === 'ios') {
                    let src = JSON.parse(t.pushEndpoint);
                    await module.registerPushApple(t.userId, tid, src.token, src.bundleId, src.sandbox);
                }
            }
        });
    });
    reader.start();
}