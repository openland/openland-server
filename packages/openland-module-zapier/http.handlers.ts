import { Express } from 'express';
import { createLogger } from '@openland/log';
import { createNamedContext } from '@openland/context';
import { inTx } from '@openland/foundationdb';
import { Store } from '../openland-module-db/FDB';
import * as bodyParser from 'body-parser';
import { Modules } from '../openland-modules/Modules';
import { IDs } from '../openland-module-api/IDs';
import { delay, foreverBreakable } from '../openland-utils/timer';
import { Shutdown } from '../openland-utils/Shutdown';
import { useOauth } from '../openland-module-oauth/http.handlers';
import { ImageRef } from 'openland-module-media/ImageRef';
import fetch from 'node-fetch';
import { extname } from 'path';
import { CacheRepository } from '../openland-module-cache/CacheRepository';

const imagesCache = new CacheRepository<ImageRef>('zapier-bot-images');

const log = createLogger('zapier');
const rootCtx = createNamedContext('zapier');

const checkAuth = useOauth('zapier');

export function initZapier(app: Express) {
    // tslint:disable-next-line:no-floating-promises
    initZapierInternal(app);
}

async function initZapierInternal(app: Express) {
    let config = await Modules.Zapier.getConfig(rootCtx);
    while (!config) {
        // log.log(rootCtx, 'config is not set');
        await delay(5000);
        config = await Modules.Zapier.getConfig(rootCtx);
    }
    let {stop} = foreverBreakable(rootCtx, async () => {
        config = await Modules.Zapier.getConfig(rootCtx);
        await delay(5000);
    });
    Shutdown.registerWork({
        name: 'zapier-handlers-config',
        shutdown: stop,
    });

    let projectUrl = (await Modules.Super.getEnvVar<string>(rootCtx, 'project-url')) || 'https://openland.com';

    app.get('/integrations/zapier/v1/triggers/fetch_chats', checkAuth, bodyParser.json(), async (req, res) => {
       await inTx(rootCtx, async ctx => {
          log.log(ctx, '/triggers/fetch_chats', req.body);
          let uid = (req as any).uid;
          let userChats = await Store.RoomParticipant.userActive.findAll(ctx, uid);
          let commonChats = await Promise.all(userChats.map(a => Store.RoomParticipant.findById(ctx, a.cid, config!.BotId)));
          commonChats = commonChats.filter(a => a && a.status === 'joined');

          res.status(200).json(
              await Promise.all(commonChats.map(async a => ({
                  id: IDs.Conversation.serialize(a!.cid),
                  title: await Modules.Messaging.room.resolveConversationTitle(ctx, a!.cid, config!.BotId),
              }))),
          );
       });
    });

    /*
    * Obsolete
    * */
    app.get('/integrations/zapier/v1/triggers/fetch_channels', checkAuth, bodyParser.json(), async (req, res) => {
        await inTx(rootCtx, async ctx => {
            log.log(ctx, '/triggers/fetch_channels', req.body);
            let uid = (req as any).uid;

            let userChannels = await Store.FeedChannelAdmin.fromUser.findAll(ctx, uid);
            let commonChannels = await Promise.all(userChannels.map(a => Store.FeedChannelAdmin.findById(ctx, a.channelId, config!.BotId)));
            commonChannels = commonChannels.filter(a => a && a.enabled && a.promoter === uid);

            let channels = await Promise.all(commonChannels.map(a => Store.FeedChannel.findById(ctx, a!.channelId)));
            res.status(200).json(channels.map(a => ({
                id: IDs.FeedChannel.serialize(a!.id),
                title: a!.title,
            })));
        });
    });

    app.post('/integrations/zapier/v1/actions/send_message', checkAuth, bodyParser.json(), async (req, res) => {
        await inTx(rootCtx, async ctx => {
            log.log(ctx, '/actions/send_message', req.body);
            if (
                !req.body ||
                !req.body.message ||
                typeof req.body.message !== 'string'
            ) {
                res.status(400).json({errors: [{message: 'Invalid params'}]});
                return;
            }
            let uid = (req as any).uid;
            let messageWasSent = false;

            let overrideAvatar: ImageRef | null = null;
            if (req.body.image) {
                let cacheEntry = await imagesCache.read(ctx, req.body.image);
                if (cacheEntry) {
                    overrideAvatar = cacheEntry;
                } else {
                    let image = await fetch(req.body.image);
                    let contentType = image.headers.get('Content-Type');
                    if (contentType && contentType.startsWith('image/')) {
                        let contents = await image.buffer();
                        let fileData = await Modules.Media.upload(ctx, contents, (extname(req.body.image).length > 0) ? extname(req.body.image) : undefined);
                        await Modules.Media.saveFile(ctx, fileData.file);
                        overrideAvatar = {
                            uuid: fileData.file,
                            crop: null,
                        };
                        await imagesCache.write(ctx, req.body.image, overrideAvatar);
                    }
                }
            }
            let messageOptions = {
                message: req.body.message,
                overrideName: req.body.name || null,
                overrideAvatar,
            };

            if (req.body.chat_id && req.body.chat_id !== '$TEST$') {
                let chatId: number;
                try {
                    chatId = IDs.Conversation.parse(req.body.chat_id.trim());
                } catch (e) {
                    res.status(400).json({errors: [{message: 'Invalid chat id'}]});
                    return;
                }
                let membership = await Store.RoomParticipant.findById(ctx, chatId, config!.BotId);
                if (membership && membership.status === 'joined' && membership.invitedBy === uid) {
                    await Modules.Messaging.sendMessage(ctx, chatId, config!.BotId, messageOptions);
                } else {
                    res.status(400).json({errors: [{message: 'Zapier bot has no permissions to write to this chat.'}]});
                    return;
                }
                messageWasSent = true;
            }
            if (req.body.channel_id && req.body.channel_id !== '$TEST$') {
                // noop
                let channelId: number;
                try {
                    channelId = IDs.FeedChannel.parse(req.body.channel_id.trim());
                } catch (e) {
                    res.status(400).json({errors: [{message: 'Invalid channel id'}]});
                    return;
                }
                let adminShip = await Store.FeedChannelAdmin.findById(ctx, channelId, config!.BotId);
                if (adminShip && adminShip.enabled && adminShip.promoter === uid) {
                    await Modules.Feed.createPostInChannel(ctx, channelId, config!.BotId, {
                        slides: [
                            {
                                type: 'text',
                                text: req.body.message,
                                spans: null,
                                cover: null,
                                coverAlign: null,
                                attachments: null,
                            },
                        ],
                    });
                } else {
                    res.status(400).json({errors: [{message: 'Zapier bot has no permissions to write to this channel.'}]});
                    return;
                }
                messageWasSent = true;
            }

            if (!messageWasSent) {
                let chat = await Modules.Messaging.room.resolvePrivateChat(ctx, config!.BotId, uid);
                await Modules.Messaging.sendMessage(ctx, chat.id, config!.BotId, messageOptions);
            }

            res.json({
                data: [
                    {
                        id: Date.now(),
                        url: projectUrl + '/' + IDs.User.serialize(config!.BotId),
                    },
                ],
            });
        });
    });
}
