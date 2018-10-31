import { CallContext } from 'openland-server/api/utils/CallContext';

export default {
    Subscription: {
        dialogUpdates: {
            resolve: async (msg: any) => {
                return msg;
            },
            subscribe: async function (_: any, args: { fromSeq?: number }, context: CallContext) {
                //
            }
        }
    }
};