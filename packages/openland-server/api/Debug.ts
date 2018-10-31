import { withAny, withPermissionOptional, withUser } from './utils/Resolvers';
import { DB, User } from '../tables';
import { normalizeCapitalized } from '../modules/Normalizer';
import { IDs } from './utils/IDs';
import { delay } from '../utils/timer';
import { Emails } from '../services/Emails';
import { NotificationsBot } from '../services/NotificationsBot';
import { Services } from '../services';
import { UserError } from '../errors/UserError';
import { fn, col } from 'sequelize';
import { geoIP, GeoIPResponse } from '../utils/geoIp/geoIP';
import { Repos } from '../repositories';
import { ImageRef } from '../repositories/Media';
import { Modules } from 'openland-modules/Modules';

export const Resolver = {
    MessagesLeaderboardItem: {
        count: (src: any) => src.dataValues.count,
        user: (src: any) => DB.User.findById(src.userId),
    },

    MessagesSentEntry: {
        count: (src: any) => src.dataValues.count,
        date: (src: any) => src.dataValues.date,
    },

    GeoIPLocation: {
        locationCode: (src: GeoIPResponse) => src.location_code,
        locationName: (src: GeoIPResponse) => src.location_name,
        coordinates: (src: GeoIPResponse) => src.coordinates ? { latitude: src.coordinates.lat, longitude: src.coordinates.long } : null
    },

    OnlineUser: {
        user: (src: User) => src,
        location: async (src: User) => {
            let ip = await Repos.Users.getUserLastIp(src.id!);
            if (!ip) {
                return null;
            }
            return geoIP(ip);
        }
    },

    BotInfo: {
        bot: (src: User) => src,
        token: async (src: User) => {
            // return (await FDB.AuthToken.fin DB.UserToken.findOne({ where: { userId: src.id! } }))!.tokenSalt;
            return '';
        }
    },

    Query: {
        ping: () => 'pong',
        debugReaderStates: withPermissionOptional(['software-developer'], async () => {
            let readers = (await DB.ReaderState.findAll());
            return readers.map((v) => ({
                id: IDs.DebugReader.serialize(v.id!!),
                title: normalizeCapitalized(v.key!!.replace('_', ' ')),
                remaining: v.remaining
            }));
        }),

        debugURLInfo: withPermissionOptional<{ url: string }>(['software-developer'], async (args, ctx) => {
            return await Services.URLInfo.fetchURLInfo(args.url);
        }),

        debugSerializeId: withPermissionOptional<any>(['software-developer'], async (args, ctx) => {
            return (IDs as any)[args.type].serialize(args.id);
        }),

        debugImagePreview: withPermissionOptional<{ uuid: string }>(['software-developer'], async (args, ctx) => {
            return await Services.UploadCare.fetchLowResPreview(args.uuid);
        }),

        statsChats: withAny<{ fromDate: string, toDate: string }>(async args => {
            let { fromDate, toDate } = args;

            let _fromDate = parseInt(fromDate, 10);
            let _toDate = parseInt(toDate, 10);

            if (isNaN(_fromDate) || isNaN(_toDate)) {
                throw new UserError('toDate & fromDate must be numbers');
            }

            if (!(toDate > fromDate)) {
                throw new UserError('toDate must be greater then fromDate');
            }

            // removing openland stuff from stats
            let userIds = (await DB.OrganizationMember.findAll({
                where: {
                    orgId: 1
                }
            })).map(m => m.userId);

            let messages = await DB.ConversationMessage.count({
                where: {
                    createdAt: { $gte: _fromDate, $lte: _toDate },
                    userId: {
                        $notIn: userIds
                    }
                },
                paranoid: false
            } as any);

            let activeUsers = await DB.ConversationMessage.count({
                distinct: true,
                where: {
                    createdAt: { $gte: _fromDate, $lte: _toDate },
                    userId: {
                        $notIn: userIds
                    }
                },
                col: 'userId',
                paranoid: false
            } as any);

            // let usersMutedEmail = await DB.UserSettings.count({
            //     where: {
            //         settings: {
            //             emailFrequency: 'never'
            //         },
            //         userId: {
            //             $notIn: userIds
            //         }
            //     }
            // });

            let messagesLeaderboard = await DB.ConversationMessage.findAll({
                limit: 20,
                where: {
                    userId: {
                        $notIn: userIds
                    }
                },
                attributes: [
                    'userId',
                    [fn('COUNT', col('conversation_message.userId')), 'count']
                ],
                order: [['count', 'DESC']],
                group: 'userId'
            });

            return {
                messagesSent: messages,
                usersActive: activeUsers,
                usersMutedEmail: 0,
                messagesLeaderboard,
                usersMutedOpenlandBeta: 0
            };
        }),

        messagesSentStats: withAny<{ fromDate: string, toDate: string, trunc?: string, excudeTeam?: boolean }>(async args => {
            let { fromDate, toDate } = args;

            let _fromDate = parseInt(fromDate, 10);
            let _toDate = parseInt(toDate, 10);

            if (isNaN(_fromDate) || isNaN(_toDate)) {
                throw new UserError('toDate & fromDate must be numbers');
            }

            if (!(toDate > fromDate)) {
                throw new UserError('toDate must be greater then fromDate');
            }

            let trunc = args.trunc || 'day';
            let truncs = [
                'second',
                'minute',
                'hour',
                'day',
                'week',
                'month',
                'quarter',
                'year',
            ];
            if (truncs.indexOf(trunc) === -1) {
                throw new UserError('invalid trunc');
            }
            try {
                let sequelize = DB.connection;

                // removing openland stuff from stats
                let userIds: number[] = [];
                if (args.excudeTeam !== false) {
                    userIds = (await DB.OrganizationMember.findAll({
                        where: {
                            orgId: 1
                        }
                    })).map(m => m.userId);
                }

                let data = await DB.ConversationMessage.findAll({
                    where: {
                        createdAt: { $gte: _fromDate, $lte: _toDate },
                        userId: {
                            $notIn: userIds
                        }
                    },
                    attributes: [
                        [sequelize.fn('date_trunc', trunc, sequelize.col('createdAt')), 'date'],
                        [fn('COUNT', col('conversation_message.id')), 'count']
                    ],
                    paranoid: false,
                    group: ['date'],
                    order: sequelize.literal('date ASC')
                } as any);

                return data;
            } catch (e) {
                console.warn(e);
                throw e;
            }

        }),

        debugSendSMS: withAny<{ phone: string, text: string }>(async args => {
            let { phone, text } = args;

            let res = await Services.TeleSign.sendSMS(phone, text);
            console.log(res);

            // while(true) {
            //     await delay(3000);
            //
            //     console.log(await Services.TeleSign.smsStatus(res.reference_id));
            // }

            return 'ok';
        }),

        // superOnlineUsers: withAny<{ phone: string, text: string }>(async args => {
        //     let onlineUsers = await DB.User.findAll({
        //         where: {
        //             lastSeen: {
        //                 $gt: Date.now()
        //             }
        //         },
        //         order: [['id', 'DESC']]
        //     });

        //     return onlineUsers;
        // }),
        // debugTest: (src: any, args: any) => {
        //     console.log(args);
        //     return 1;
        // }

        alphaMyBots: withUser(async (args, uid) => {
            return DB.User.findAll({
                where: {
                    isBot: true,
                    extras: {
                        botOwner: uid
                    }
                }
            });
        })
    },
    Mutation: {
        debugFoundation: async () => {
            await Modules.Workers.TestWorker.pushWork({ value: 0 });
            // return inTx(async () => {
            //     let counter = await FDB.Counter.findById('sample');
            //     if (counter) {
            //         return counter.value++;
            //     } else {
            //         await FDB.Counter.create('sample', { value: 0 });
            //         return 0;
            //     }
            // });
            return 0;
            // return (await FDB2.Counter.findById('sample'))!.value;
            // return inTx(async () => {
            //     let res = await FDB.SampeCounter.get();
            //     res++;
            //     FDB.SampeCounter.set(res);
            //     return res;
            // });
        },
        debugSendWelcomeEmail: withUser(async (args, uid) => {
            await Emails.sendWelcomeEmail(uid);
            return 'ok';
        }),

        debugSendEmail: withPermissionOptional<{ email: string, text: string }>(['software-developer'], async (args, ctx) => {
            // await Emails.sendDebugEmail(args.email, args.text);
            await Emails.sendUnreadMesages(ctx.uid!, 10);

            return 'ok';
        }),

        debugTestNotification: withPermissionOptional<any>(['software-developer'], async (args, ctx) => {
            if (!ctx.uid) {
                return 'ok';
            }

            await NotificationsBot.sendNotification(ctx.uid, { message: 'test notification' });

            return 'ok';
        }),

        alphaCreateBot: withUser<{
            input: {
                firstName: string,
                lastName?: string | null,
                photoRef?: ImageRef | null,
                phone?: string | null,
                email?: string | null,
                website?: string | null,
                about?: string | null,
                location?: string | null
            }
        }>(async (args, uid) => {
            return DB.txLight(async (tx) => {
                let user = await DB.User.create({
                    authId: 'bot|u-' + uid,
                    email: '',
                    status: 'ACTIVATED',
                    isBot: true,
                    extras: {
                        botOwner: uid
                    }
                }, { transaction: tx });
                await Repos.Users.createUser(user.id!, args.input, tx, true);
                return await Modules.Auth.createToken(user.id!);
            });
        }),

        alphaResetUrlInfoCache: async () => {
            // await DB.ServicesCache.destroy({
            //     where: {
            //         service: 'url_info'
            //     }
            // });
            return 'ok';
        }

    },
    Subscription: {
        lifecheck: {
            resolve: (root: any) => {
                // console.log('subscription server resolve', { root });
                return root;
            },
            subscribe: async function* g() {
                console.warn('start');
                while (true) {
                    yield new Date().toUTCString();
                    await delay(1000);
                }
            }
        }
    }
};