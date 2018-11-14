import { Modules } from 'openland-modules/Modules';
import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { AppContext } from 'openland-modules/AppContext';

export default {
    Query: {
        myProfilePrefill: async function (_: any, args: {}, ctx: AppContext) {
            if (!ctx.auth.uid) {
                return {};
            }
            let prefill = await Modules.Users.findProfilePrefill(ctx.auth.uid);
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