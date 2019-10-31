import { Store } from '../openland-module-db/FDB';
import { Context, createNamedContext } from '@openland/context';
import { UserDialogMessageReceivedEvent } from '../openland-module-db/store';
import { Modules } from '../openland-modules/Modules';
import { inTx } from '@openland/foundationdb';
import { buildMessage, link } from '../openland-utils/MessageBuilder';
import { createLogger } from '@openland/log';
import { delay, forever } from '../openland-utils/timer';

const rootCtx = createNamedContext('IFTTT-bot');
const log = createLogger('IFTTT-bot');

async function * botEventsStream(ctx: Context, uid: number) {
    let stream = Store.UserDialogEventStore.createLiveStream(rootCtx, uid, { batchSize: 20 });
    for await (let event of stream) {
        for (let item of event.items) {
            if (item instanceof UserDialogMessageReceivedEvent) {
                let message = (await Store.Message.findById(ctx, item.mid))!;
                if (message.uid !== uid) {
                    yield { type: 'new_message', message };
                }
            }
        }
    }
}

export async function startIFTTTBot() {
    let config = await Modules.IFTTT.getConfig(rootCtx);
    while (!config) {
        log.log(rootCtx, 'config is not set');
        await delay(5000);
        config = await Modules.IFTTT.getConfig(rootCtx);
    }
    forever(rootCtx, async () => {
        config = await Modules.IFTTT.getConfig(rootCtx);
        await delay(5000);
    });

    let stream = botEventsStream(rootCtx, config.BotId);
    for await (let event of stream) {
        await inTx(rootCtx, async ctx => {
            let message = event.message;
            if (message.text && message.text.startsWith('ifttt-auth:')) {
                let code = message.text.replace('ifttt-auth:', '');
                let iftttAuth = await Store.IftttAuth.findById(ctx, code);
                if (!iftttAuth) {
                    await Modules.Messaging.sendMessage(ctx, message.cid, config!.BotId, { message: 'Invalid code!' });
                    return;
                }
                iftttAuth.uid = message.uid;
                let authLink = `${iftttAuth.redirectUrl}?code=${iftttAuth.code}&state=${iftttAuth.state}`;
                await Modules.Messaging.sendMessage(ctx, message.cid, config!.BotId, buildMessage('Please open ', link('link', authLink), ' to authorize in IFTTT.'));
            }
        });
    }
}