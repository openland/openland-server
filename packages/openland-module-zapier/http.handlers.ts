import { Express } from 'express';
import express from 'express';
import { createLogger } from '@openland/log';
import { createNamedContext } from '@openland/context';
import { inTx } from '@openland/foundationdb';
import { Store } from '../openland-module-db/FDB';
import * as bodyParser from 'body-parser';
import { Modules } from '../openland-modules/Modules';
import { IDs } from '../openland-module-api/IDs';
import { delay, foreverBreakable } from '../openland-utils/timer';
import { Shutdown } from '../openland-utils/Shutdown';

const log = createLogger('zapier');
const rootCtx = createNamedContext('zapier');

async function checkAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
    await inTx(rootCtx, async ctx => {
        if (!req.headers.authorization) {
            res.status(401).json({errors: [{message: 'Invalid auth'}]});
            return;
        }
        let [bearer, token] = req.headers.authorization.split(' ');
        if (bearer !== 'Bearer') {
            res.status(401).json({errors: [{message: 'Invalid auth'}]});
            return;
        }
        let authToken = await Store.ZapierAuthToken.salt.find(ctx, token);
        if (!authToken || !authToken.enabled) {
            res.status(401).json({errors: [{message: 'Invalid auth'}]});
            return;
        }
        (req as any).uid = authToken.uid;
        next();
    });
}

export function initZapier(app: Express) {
    // tslint:disable-next-line:no-floating-promises
    initZapierInternal(app);
}

async function initZapierInternal(app: Express) {
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
        name: 'zapier-handlers-config',
        shutdown: stop
    });

    let projectUrl = (await Modules.Super.getEnvVar<string>(rootCtx, 'project-url')) || 'https://openland.com';

    app.get('/integrations/zapier/oauth2/authorize', async (req, res) => {
        await inTx(rootCtx, async ctx => {
            log.log(ctx, '/oauth2/authorize', req.query);
            if (
                !req.query ||
                req.query.client_id !== config!.ClientId ||
                !req.query.state ||
                typeof req.query.state !== 'string' ||
                req.query.state.trim().length === 0 ||
                !req.query.redirect_uri ||
                typeof req.query.redirect_uri !== 'string' ||
                req.query.redirect_uri.trim().length === 0 ||
                req.query.response_type !== 'code'
            ) {
                res.redirect(projectUrl);
                return;
            }
            let zapierAuth = await Modules.Zapier.createAuth(ctx, req.query.state, req.query.redirect_uri);
            res.redirect(`${projectUrl}/mail/${IDs.User.serialize(config!.BotId)}?message=zapier-auth:${zapierAuth.id}`);
        });
    });
    app.post('/integrations/zapier/oauth2/token', bodyParser.urlencoded(), async (req, res) => {
        await inTx(rootCtx, async ctx => {
            log.log(ctx, '/oauth2/token', req.body);
            let body = req.body;
            if (
                !body.code ||
                body.client_id !== config!.ClientId ||
                body.client_secret !== config!.ClientSecret ||
                body.grant_type !== 'authorization_code'
            ) {
                log.log(ctx, 'invalid params');
                res.json({errors: [{message: 'Invalid params'}]});
                return;
            }
            let auth = await Store.ZapierAuth.fromCode.find(ctx, body.code);
            if (!auth || !auth.enabled || !auth.uid) {
                log.log(ctx, 'invalid code');
                res.json({errors: [{message: 'Invalid code'}]});
                return;
            }
            if (body.redirect_uri !== auth.redirectUrl) {
                log.log(ctx, 'invalid redirect_uri');
                res.json({errors: [{message: 'Invalid redirect_uri'}]});
                return;
            }
            auth.enabled = false;
            let token = await Modules.Zapier.createToken(ctx, auth.uid);
            log.log(ctx, 'token granted');
            res.json({token_type: 'Bearer', access_token: token.salt});
            let chat = await Modules.Messaging.room.resolvePrivateChat(ctx, config!.BotId, auth.uid);
            await Modules.Messaging.sendMessage(ctx, chat.id, config!.BotId, {message: 'Zapier connected successfully!'});
        });
    });
    app.get('/integrations/zapier/v1/user/info', checkAuth, async (req, res) => {
        await inTx(rootCtx, async ctx => {
            let uid = (req as any).uid;
            log.log(ctx, '/user/info', 'uid:', uid);
            res.json({
                data: {
                    name: await Modules.Users.getUserFullName(ctx, uid),
                    id: IDs.User.serialize(uid),
                    url: projectUrl + '/' + IDs.User.serialize(uid)
                }
            });
        });
    });

    app.get('/integrations/zapier/v1/triggers/fetch_chats', checkAuth, bodyParser.json(), async (req, res) => {
       await inTx(rootCtx, async ctx => {
          log.log(ctx, '/triggers/fetch_chats', req.body);
          let uid = (req as any).uid;
          let userChats = await Store.RoomParticipant.userActive.findAll(ctx, uid);
          let commonChats = await Promise.all(userChats.map(a => Store.RoomParticipant.findById(ctx, a.cid, config!.BotId)));
          commonChats = commonChats.filter(a => a && a.status === 'joined' && a.invitedBy === uid);

          res.status(200).json(
              await Promise.all(commonChats.map(async a => ({
                  id: IDs.Conversation.serialize(a!.cid),
                  title: await Modules.Messaging.room.resolveConversationTitle(ctx, a!.cid, config!.BotId)
              })))
          );
       });
    });

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
                title: a!.title
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
                    await Modules.Messaging.sendMessage(ctx, chatId, config!.BotId, {message: req.body.message});
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
                                attachments: null
                            }
                        ]
                    });
                } else {
                    res.status(400).json({errors: [{message: 'Zapier bot has no permissions to write to this channel.'}]});
                    return;
                }
                messageWasSent = true;
            }
            if (!messageWasSent) {
                let chat = await Modules.Messaging.room.resolvePrivateChat(ctx, config!.BotId, uid);
                await Modules.Messaging.sendMessage(ctx, chat.id, config!.BotId, {message: req.body.message});
            }

            res.json({
                data: [
                    {
                        id: Date.now(),
                        url: projectUrl + '/' + IDs.User.serialize(config!.BotId)
                    }
                ]
            });
        });
    });
}