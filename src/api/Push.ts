import { CallContext } from './utils/CallContext';
import { DB } from '../tables';
import { AppConfiuguration } from '../init/initConfig';

export const Resolvers = {
    Query: {
        pushSettings: () => ({
            webPushKey: AppConfiuguration.webPush && AppConfiuguration.webPush.public
        })
    },
    Mutation: {
        registerWebPush: async (_: any, args: { endpoint: string }, context: CallContext) => {
            if (!context.uid || !context.tid) {
                throw Error('Unable to register push for non-registered user');
            }
            return DB.txStable(async (tx) => {
                let existing = await DB.UserPushRegistration.find({
                    where: {
                        userId: context.uid!!,
                        tokenId: context.tid!!,
                        pushType: 'web-push'
                    },
                    transaction: tx,
                    lock: tx.LOCK.UPDATE
                });
                if (existing) {
                    if (existing.pushEndpoint === args.endpoint) {
                        return 'ok';
                    } else {
                        existing.pushEndpoint = args.endpoint;
                        await existing.save({ transaction: tx });
                        return 'ok';
                    }
                } else {
                    await DB.UserPushRegistration.create({
                        userId: context.uid,
                        tokenId: context.tid,
                        pushEndpoint: args.endpoint,
                        pushType: 'web-push'
                    });
                    return 'ok';
                }
            });
        },
        registerPush: async (_: any, args: { endpoint: string, type: 'WEB_PUSH' | 'IOS' | 'ANDROID' }, context: CallContext) => {
            if (!context.uid || !context.tid) {
                throw Error('Unable to register push for non-registered user');
            }
            let type = 'web-push';
            if (args.type === 'IOS') {
                type = 'ios';
            } else if (args.type === 'ANDROID') {
                type = 'android';
            }
            return DB.txStable(async (tx) => {
                let existing = await DB.UserPushRegistration.find({
                    where: {
                        userId: context.uid!!,
                        tokenId: context.tid!!,
                        pushType: type
                    },
                    transaction: tx,
                    lock: tx.LOCK.UPDATE
                });
                if (existing) {
                    if (existing.pushEndpoint === args.endpoint) {
                        return 'ok';
                    } else {
                        existing.pushEndpoint = args.endpoint;
                        await existing.destroy({ transaction: tx });
                    }
                } 
                await DB.UserPushRegistration.create({
                    userId: context.uid,
                    tokenId: context.tid,
                    pushEndpoint: args.endpoint,
                    pushType: type as any
                }, { transaction: tx });
                return 'ok';
            });
        }
    }
};