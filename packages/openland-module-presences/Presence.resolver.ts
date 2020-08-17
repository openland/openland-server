import { Modules } from 'openland-modules/Modules';
import { IDs } from 'openland-module-api/IDs';
import { OnlineEvent } from './PresenceModule';
import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { UserError } from '../openland-errors/UserError';
import { AccessDeniedError } from '../openland-errors/AccessDeniedError';
import { Metrics } from 'openland-module-monitoring/Metrics';
import { Store } from '../openland-module-db/FDB';
import { inTx } from '@openland/foundationdb';

export const Resolver: GQLResolver = {
    OnlineEvent: {
        userId: (src: OnlineEvent) => IDs.User.serialize(src.userId),
        timeout: (src: OnlineEvent) => src.timeout,
        online: (src: OnlineEvent) => src.online,
        active: (src: OnlineEvent) => src.active,
        lastSeen: (src: OnlineEvent) => src.lastSeen.toString(10),

        type: (src: OnlineEvent) => src.online ? 'online' : 'offline',
        user: (src: OnlineEvent) => src.userId,
    },
    Mutation: {
        presenceReportOnline: async (_, args, parent) => {
            return await inTx(parent, async (ctx) => {
                if (!ctx.auth.uid) {
                    throw new UserError('Not authorized');
                }
                if (args.timeout <= 0) {
                    throw new UserError('Invalid input');
                }
                if (args.timeout > 5000) {
                    throw new UserError('Invalid input');
                }
                let active = (args.active !== undefined && args.active !== null) ? args.active! : true;

                await Modules.Presence.setOnline(ctx, ctx.auth.uid, ctx.auth.tid!, args.timeout, args.platform || 'unknown', active);
                if (ctx.req.ip) {
                    let token = await Store.AuthToken.findById(ctx, ctx.auth.tid!);
                    token!.lastIp = ctx.req.ip;
                }

                if (active) {
                    Metrics.Online.add(1, 'uid-' + ctx.auth.uid!, 5000);
                    if (args.platform) {
                        if (args.platform.startsWith('web')) {
                            Metrics.OnlineWeb.add(1, 'uid-' + ctx.auth.uid!, 5000);
                        } else if (args.platform.startsWith('android')) {
                            Metrics.OnlineAndroid.add(1, 'uid-' + ctx.auth.uid!, 5000);
                        } else if (args.platform.startsWith('ios')) {
                            Metrics.OnlineIOS.add(1, 'uid-' + ctx.auth.uid!, 5000);
                        } else {
                            Metrics.OnlineUnknown.add(1, 'uid-' + ctx.auth.uid!, 5000);
                        }
                    } else {
                        Metrics.OnlineUnknown.add(1, 'uid-' + ctx.auth.uid!, 5000);
                    }
                }

                return 'ok';
            });
        }
    },
    Subscription: {
        alphaSubscribeOnline: {
            resolve: async (msg: any) => {
                return msg;
            },
            subscribe: async (_, args, ctx) => {
                if (!ctx.auth.uid) {
                    throw new AccessDeniedError();
                }
                let userIds = args.users.map(c => IDs.User.parse(c));
                return Modules.Presence.createPresenceStream(ctx.auth.uid!, userIds);
            }
        },
        chatOnlinesCount: {
            resolve: async (msg: any) => {
                return msg;
            },
            subscribe: async (_, args, ctx) => {
                if (!ctx.auth.uid) {
                    throw new AccessDeniedError();
                }
                
                let cid = IDs.Conversation.parse(args.chatId);
                await Modules.Messaging.room.checkAccess(ctx, ctx.auth.uid, cid);
                return Modules.Presence.groups.createPresenceStream(cid);
            }
        }
    }
};
