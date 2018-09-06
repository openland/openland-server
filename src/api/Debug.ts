import { withAny, withPermissionOptional, withUser } from './utils/Resolvers';
import { DB } from '../tables';
import { normalizeCapitalized } from '../modules/Normalizer';
import { IDs } from './utils/IDs';
import { delay } from '../utils/timer';
import { Emails } from '../services/Emails';
import { NotificationsBot } from '../services/NotificationsBot';
import { Services } from '../services';
import { UserError } from '../errors/UserError';
import TeleSignSDK from 'telesignsdk';

export const Resolver = {
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

            return {
                messagesSent: messages,
                usersActive: activeUsers
            };
        }),

        debugSendSMS: withAny<{phone: string, text: string}>(async args => {
            let {phone, text} = args;

            console.log(phone, text);

            let client = new TeleSignSDK(
                '05A641AD-6A27-44C4-98F4-7AA79339F2F3',
                'aTcckxONYt1rO2/FmwqaKG7qlgDwsUY8mUPA2w9Eu+s49yguJLfWsd2J/rGFg8O0zcQNBJjM0b3EwH/Pj5VgUw==',
                'https://rest-api.telesign.com',
                10 * 1000 // optional
                // userAgent
            );

            // client.sms.message(
            //     (err: any, resp: any) => {
            //         console.log(err, resp);
            //     },
            //     phone,
            //     text,
            //     'ARN'
            // );

            client.sms.status(
                (err: any, resp: any) => {
                    console.log(err, resp);
                },
                '3596BE1E9624086891558D425D305EF7'
            );
            console.log(client);
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