import { withUser } from './utils/Resolvers';
import { IDs } from './utils/IDs';
import { DB } from '../tables';
import { Log } from '../Log';
import { PrivateCall } from '../tables/PrivateCall';

export const Resolver = {
    Call: {
        __resolveType: () => {
            return 'PrivateCall';
        }
    },
    PrivateCall: {
        id: (src: PrivateCall) => IDs.PrivateCall.serialize(src.id),
        caller: (src: PrivateCall) => DB.User.findById(src.callerId),
        callee: (src: PrivateCall) => DB.User.findById(src.calleeId)
    },
    Mutation: {
        callStartPrivate: withUser<{ uid: string, timeout: number }>(async (args, uid) => {
            let callee = IDs.User.parse(args.uid);
            let caller = uid;

            let res = await DB.PrivateCall.create({
                callerId: caller,
                callerTimeout: new Date(Date.now() + args.timeout),
                calleeId: callee
            });
            Log.Calls.log('[' + res.id + '] Call requested (' + caller + '->' + callee + ')');
            return res;
        }),
        callKeepAlive: withUser<{ id: string, timeout: number }>(async (args, uid) => {
            let callId = IDs.PrivateCall.parse(args.id);
            return await DB.txStable(async (tx) => {
                let pcall = (await DB.PrivateCall.findById(callId, { transaction: tx, lock: tx.LOCK.UPDATE }))!;
                if (!pcall.active) {
                    Log.Calls.log('[' + pcall.id + '] Keep alive ignored, already completed (' + uid + ')');
                    return false;
                }
                if (pcall.calleeId === uid) {
                    Log.Calls.log('[' + pcall.id + '] Keep alive (' + uid + ')');
                    pcall.calleeTimeout = new Date(Date.now() + args.timeout);
                    pcall.save({ transaction: tx });
                    return true;
                } else if (pcall.callerId === uid) {
                    Log.Calls.log('[' + pcall.id + '] Keep alive (' + uid + ')');
                    pcall.callerTimeout = new Date(Date.now() + args.timeout);
                    pcall.save({ transaction: tx });
                    return true;
                } else {
                    Log.Calls.log('[' + pcall.id + '] Keep alive ignored, wrong sender (' + uid + ')');
                    return false;
                }
            });
        }),
        callStop: withUser<{ id: string }>(async (args, uid) => {
            let callId = IDs.PrivateCall.parse(args.id);
            return await DB.txStable(async (tx) => {
                let pcall = (await DB.PrivateCall.findById(callId, { transaction: tx, lock: tx.LOCK.UPDATE }))!;
                if (!pcall.active) {
                    Log.Calls.log('[' + pcall.id + '] Call stop ignored, already completed (' + uid + ')');
                    return false;
                }
                if (pcall.calleeId === uid || pcall.callerId === uid) {
                    Log.Calls.log('[' + pcall.id + '] Stopping call (' + uid + ')');
                    pcall.active = false;
                    pcall.save({ transaction: tx });
                } else {
                    Log.Calls.log('[' + pcall.id + '] Call stop ignored, wrong sender (' + uid + ')');
                }
                return false;
            });
        })
    }
};