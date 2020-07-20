import { Context } from '@openland/context';
import { Modules } from 'openland-modules/Modules';
import { withAccount, withAny } from 'openland-module-api/Resolvers';
import { IDs } from 'openland-module-api/IDs';
import { OnlineEvent } from './PresenceModule';
import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { CacheRepository } from '../openland-module-cache/CacheRepository';
import { UserError } from '../openland-errors/UserError';
import { AccessDeniedError } from '../openland-errors/AccessDeniedError';
import { Metrics } from 'openland-module-monitoring/Metrics';
import { Store } from '../openland-module-db/FDB';
import { inTx } from '@openland/foundationdb';
import { merge } from 'rxjs';
import { createIterator } from '../openland-utils/asyncIterator';
import { createRemoteStream } from '../openland-module-pubsub/createRemoteStream';

const cache = new CacheRepository<{ at: number }>('user_installed_apps');

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
    IsAppInstalledResponse: {
        installed: src => src.installed,
        installedAt: src => src.installedAt
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
        },
        presenceReportOffline: withAny(async (ctx, args) => {
            await Modules.Presence.setOffline(ctx, ctx.auth.uid!);
            return 'ok';
        }),

        // TODO: Move to Push Module
        alphaReportActive: async (_: any, args, ctx: Context) => {
            if (!ctx.auth.uid) {
                throw Error('Not authorized');
            }
            if (args.timeout <= 0) {
                throw Error('Invalid input');
            }
            if (args.timeout > 5000) {
                throw Error('Invalid input');
            }

            // FIXME
            // let token = await DB.UserToken.findById(context.tid);
            // token!.lastIp = context.ip;
            // await token!.save();

            // await Repos.Users.markUserActive(context.uid, args.timeout, context.tid!!, args.platform);
            return 'ok';
        },
        alphaSetDesktopInstalled: withAccount(async (parent, args, uid) => {
            await cache.write(parent, `${uid}_desktop`, { at: args.at.getTime() });
            return true;
        }),
        alphaSetMobileInstalled: withAccount(async (parent, args, uid) => {
            await cache.write(parent, `${uid}_mobile`, { at: args.at.getTime() });
            return true;
        }),
    },
    Query: {
        isDesktopInstalled: withAccount(async (parent, args, uid) => {
            let val = await cache.read(parent, `${uid}_desktop`);
            if (!val) {
                return { installed: false };
            }
            return { installed: true, installedAt: val.at.toString() };
        }),
        isMobileInstalled: withAccount(async (parent, args, uid) => {
            let val = await cache.read(parent, `${uid}_mobile`);
            if (!val) {
                return { installed: false };
            }
            return { installed: true, installedAt: val.at.toString() };
        }),
    },
    Subscription: {
        alphaSubscribeChatOnline: {
            resolve: async (msg: any) => {
                return msg;
            },
            subscribe: async (_, args, ctx) => {
                if (!ctx.auth.uid) {
                    throw new AccessDeniedError();
                }
                let conversationIds = args.conversations.map(c => IDs.Conversation.parse(c));

                let observables = await Promise.all(conversationIds.map(cid => {
                    return createRemoteStream<{ uid: number, chatId: number }, OnlineEvent>('presence.chatPresenceStream', {
                        chatId: cid, uid: ctx.auth.uid!
                    });
                }));
                let observable = merge(observables);
                let iterator = createIterator(() => {
                    // do nothing
                });
                observable.subscribe((val) => {
                    iterator.push(val);
                });
                return iterator;
            }
        },
        alphaSubscribeOnline: {
            resolve: async (msg: any) => {
                return msg;
            },
            subscribe: async (_, args, ctx) => {
                if (!ctx.auth.uid) {
                    throw new AccessDeniedError();
                }
                let userIds = args.users.filter(c => {
                    try {
                        IDs.User.parse(c);
                        return true;
                    } catch {
                        return false;
                    }
                }).map(c => IDs.User.parse(c));

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
                let iterator = createIterator(() => {
                    // do nothing
                });
                let observable = await createRemoteStream<{ uid: number, chatId: number }, { onlinesCount: number }>(
                    'presence.chatOnlineCountStream', {
                        chatId: IDs.Conversation.parse(args.chatId),
                        uid: ctx.auth.uid
                    });

                observable.subscribe((next) => iterator.push(next));
                return iterator;
            }
        }
    }
};
