import { CallContext } from './utils/CallContext';
import { DB } from '../tables';

export const Resolvers = {
    Query: {
        pushSettings: () => ({
            webPushKey: process.env.WEB_PUSH_PUBLIC
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
                        tokenId: context.tid!!
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
                        pushEndpoint: args.endpoint
                    });
                    return 'ok';
                }
            });
        }
    }
};