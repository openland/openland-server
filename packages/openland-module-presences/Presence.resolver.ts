import { Modules } from 'openland-modules/Modules';
import { IDs } from 'openland-module-api/IDs';
import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { UserError } from '../openland-errors/UserError';
import { AccessDeniedError } from '../openland-errors/AccessDeniedError';
import { Metrics } from 'openland-module-monitoring/Metrics';
import { Store } from '../openland-module-db/FDB';
import { inTx } from '@openland/foundationdb';
import { UserOnlineStatus } from './mediator/UserPresenceMediator';

export const Resolver: GQLResolver = {
    OnlineEvent: {
        user: (src: UserOnlineStatus) => src.uid,

        // Not used
        timeout: (src: UserOnlineStatus) => 0,
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
                if (args.timeout > 60 * 1000) {
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
        },
        presenceReportOffline: async (_, args, parent) => {
            return await inTx(parent, async (ctx) => {
                if (!ctx.auth.uid) {
                    throw new UserError('Not authorized');
                }

                await Modules.Presence.setOffline(ctx, ctx.auth.uid, ctx.auth.tid!);

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
                return Modules.Presence.users.createPresenceStream(userIds);
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
