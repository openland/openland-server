import { Modules } from 'openland-modules/Modules';
import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';

export default {
    Query: {
        myProfilePrefill: async (r, args, ctx) => {
            if (!ctx.auth.uid) {
                return {};
            }
            let prefill = await Modules.Users.findProfilePrefill(ctx, ctx.auth.uid);
            if (prefill) {
                return {
                    firstName: prefill.firstName,
                    lastName: prefill.lastName,
                    picture: prefill.picture,
                };
            } else {
                return {};
            }
        },
    }
} as GQLResolver;