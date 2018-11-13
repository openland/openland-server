import { Modules } from 'openland-modules/Modules';
import { CallContext } from 'openland-module-api/CallContext';
import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';

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
} as GQLResolver;