import { Modules } from 'openland-modules/Modules';
import { CallContext } from 'openland-server/api/utils/CallContext';

export default {
    Query: {
        myProfilePrefill: async function (_: any, args: {}, context: CallContext) {
            if (!context.uid) {
                return {};
            }
            let prefill = await Modules.Users.findProfilePrefill(context.uid);
            if (prefill) {
                return {
                    firstName: prefill.firstName,
                    lastName: prefill.lastName,
                    picture: prefill.picture
                };
            } else {
                return {};
            }
        },
    }
};