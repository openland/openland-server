import { Store } from '../openland-module-db/FDB';
import { Context, createNamedContext } from '@openland/context';
import { UserDialogMessageReceivedEvent } from '../openland-module-db/store';
import { Modules } from '../openland-modules/Modules';
import { inTx } from '@openland/foundationdb';
import { buildMessage, link } from '../openland-utils/MessageBuilder';
import { createLogger } from '@openland/log';
import { delay, foreverBreakable } from '../openland-utils/timer';
import { Shutdown } from '../openland-utils/Shutdown';

const rootCtx = createNamedContext('zapier-bot');
const log = createLogger('zapier-bot');

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

export async function startZapierBot() {
    let config = await Modules.Zapier.getConfig(rootCtx);
    while (!config) {
        log.log(rootCtx, 'config is not set');
        await delay(5000);
        config = await Modules.Zapier.getConfig(rootCtx);
    }
    let {stop} = foreverBreakable(rootCtx, async () => {
        config = await Modules.Zapier.getConfig(rootCtx);
        await delay(5000);
    });
    Shutdown.registerWork({
        name: 'zapier-bot-config',
        shutdown: stop
    });

    let stream = botEventsStream(rootCtx, config.BotId);
    for await (let event of stream) {
        await inTx(rootCtx, async ctx => {
            let message = event.message;
            if (message.text && message.text.startsWith('zapier-auth:')) {
                let code = message.text.replace('zapier-auth:', '');
                let zapierAuth = await Store.ZapierAuth.findById(ctx, code);
                if (!zapierAuth) {
                    await Modules.Messaging.sendMessage(ctx, message.cid, config!.BotId, { message: 'Invalid code!' });
                    return;
                }
                zapierAuth.uid = message.uid;
                let authLink = `${zapierAuth.redirectUrl}?code=${zapierAuth.code}&state=${zapierAuth.state}`;
                await Modules.Messaging.sendMessage(ctx, message.cid, config!.BotId, buildMessage('Please open ', link('link', authLink), ' to authorize in Zapier.'));
            }
        });
    }
}