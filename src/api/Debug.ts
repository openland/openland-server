import { withAny, withPermissionOptional, withUser } from './utils/Resolvers';
import { DB } from '../tables';
import { normalizeCapitalized } from '../modules/Normalizer';
import { IDs } from './utils/IDs';
import { delay } from '../utils/timer';
import { Emails } from '../services/Emails';
import { NotificationsBot } from '../services/NotificationsBot';
import { Services } from '../services';
import { UserError } from '../errors/UserError';
import { fn, col } from 'sequelize';

export const Resolver = {
    MessagesLeaderboardItem: {
        count: (src: any) => src.dataValues.count,
        userId: (src: any) => IDs.User.serialize(src.userId)
    },

    Query: {
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

        statsChats: withAny<{fromDate: string, toDate: string}>(async args => {
            let {fromDate, toDate} = args;

            let _fromDate = parseInt(fromDate, 10);
            let _toDate = parseInt(toDate, 10);

            if (isNaN(_fromDate) || isNaN(_toDate)) {
                throw new UserError('toDate & fromDate must be numbers');
            }

            if (!(toDate > fromDate)) {
                throw new UserError('toDate must be greater then fromDate');
            }

            let messages = await DB.ConversationMessage.count({
                where: {
                    createdAt: { $gte: _fromDate, $lte: _toDate }
                },
                paranoid: false
            } as any);

            let activeUsers = await DB.ConversationMessage.count({
                distinct: true,
                where: {
                    createdAt: { $gte: _fromDate, $lte: _toDate }
                },
                col: 'userId',
                paranoid: false
            } as any);

            let usersMutedEmail = await DB.UserSettings.count({
                where: {
                    settings: {
                        emailFrequency: 'never'
                    }
                }
            });

            let messagesLeaderboard = await DB.ConversationMessage.findAll({
                limit: 20,
                attributes: [
                    'userId',
                    [fn('COUNT', col('conversation_message.userId')), 'count']
                ],
                order: [['count', 'DESC']],
                group: 'userId'
            });

            let usersMutedOpenlandBeta = await DB.ConversationUserState.count({
               where: {
                   conversationId: 621,
                   notificationsSettings: {
                       mute: true
                   }
               }
            });

            return {
                messagesSent: messages,
                usersActive: activeUsers,
                usersMutedEmail,
                messagesLeaderboard,
                usersMutedOpenlandBeta
            };
        }),

        debugSendSMS: withAny<{phone: string, text: string}>(async args => {
            let {phone, text} = args;

            let res = await Services.TeleSign.sendSMS(phone, text);
            console.log(res);

            return 'ok';
        }),

        // debugTest: (src: any, args: any) => {
        //     console.log(args);
        //     return 1;
        // }
    },
    Mutation: {
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
        })
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