import { Modules } from 'openland-modules/Modules';
import { IDs } from 'openland-module-api/IDs';
import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { UserError } from '../openland-errors/UserError';
import { AccessDeniedError } from '../openland-errors/AccessDeniedError';
import { Metrics } from 'openland-module-monitoring/Metrics';
import { Store } from '../openland-module-db/FDB';
import { inTx } from '@openland/foundationdb';
import { UserOnlineStatus } from './mediator/UserPresenceMediator';

const isMobile = (p: string) => (p.startsWith('android') || p.startsWith('ios'));

export const Resolver: GQLResolver = {
    OnlineEvent: {
        user: (src: UserOnlineStatus) => src.uid,

        // Not used
        timeout: (src: UserOnlineStatus) => 0,
    },
    Mutation: {
        presenceReportOnline: async (_, args, parent) => {
            return await inTx(parent, async (ctx) => {
                // Resolve parameters
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
                let platform = args.platform || 'unknown';

                // Handle presence
                if (!(await Modules.Presence.logging.hasMobile(ctx, ctx.auth.uid)) && isMobile(platform)) {
                    Modules.Presence.logging.setMobile(ctx, ctx.auth.uid);
                    await Modules.Hooks.onNewMobileUser(ctx, ctx.auth.uid);
                }

                // Update account online status
                await Modules.Presence.setOnline(ctx, ctx.auth.uid, ctx.auth.tid!, args.timeout, platform, active);

                // Update Token
                if (ctx.req.ip) {
                    let token = (await Store.AuthToken.findById(ctx, ctx.auth.tid!))!;
                    token.lastIp = ctx.req.ip;
                    token.platform = platform;
                }

                // Monitoring
                if (active) {
                    Metrics.Online.add(1, 'uid-' + ctx.auth.uid!, args.timeout);
                    if (args.platform) {
                        if (args.platform.startsWith('web')) {
                            Metrics.OnlineWeb.add(1, 'uid-' + ctx.auth.uid!, args.timeout);
                        } else if (args.platform.startsWith('android')) {
                            Metrics.OnlineAndroid.add(1, 'uid-' + ctx.auth.uid!, args.timeout);
                        } else if (args.platform.startsWith('ios')) {
                            Metrics.OnlineIOS.add(1, 'uid-' + ctx.auth.uid!, args.timeout);
                        } else {
                            Metrics.OnlineUnknown.add(1, 'uid-' + ctx.auth.uid!, args.timeout);
                        }
                    } else {
                        Metrics.OnlineUnknown.add(1, 'uid-' + ctx.auth.uid!, args.timeout);
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
