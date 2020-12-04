import { Modules } from 'openland-modules/Modules';
import { Store } from 'openland-module-db/FDB';
import { Context } from '@openland/context';
import { AuthContext } from 'openland-module-auth/AuthContext';
import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';

export const Resolver: GQLResolver = {
    Query: {
        sessionState: async function (_: any, args: {}, ctx: Context) {

            let auth = AuthContext.get(ctx);

            // If there are no user in the context
            if (!auth.uid) {
                return {
                    isLoggedIn: false,
                    isProfileCreated: false,
                    isActivated: false,
                    isAccountExists: false,
                    isCompleted: false,
                    isBlocked: false,
                    // deprecated
                    isAccountPicked: false,
                    isAccountActivated: false,
                };
            }

            // User unknown?! Just softly ignore errors
            let res = await Store.User.findById(ctx, auth.uid);
            if (res === null) {
                return {
                    isLoggedIn: false,
                    isProfileCreated: false,
                    isActivated: false,
                    isAccountExists: false,
                    isCompleted: false,
                    isBlocked: false,
                    // deprecated
                    isAccountPicked: false,
                    isAccountActivated: false,
                };
            }

            // State 0: Is Logged In
            let isLoggedIn = true; // Checked in previous steps
            let isActivated = res.status === 'activated';

            // Stage 1: Create Profile
            let profile = auth.uid ? (await Modules.Users.profileById(ctx, auth.uid)) : null;
            let isProfileCreated = !!profile;

            let queryResult = {
                isLoggedIn: isLoggedIn,
                isProfileCreated: isProfileCreated,
                isActivated: isActivated,
                isAccountExists: isProfileCreated,
                // isCompleted: isProfileCreated && isOrganizationExists && isOrganizationPicked && isActivated,
                isCompleted: isProfileCreated && isActivated,
                isBlocked: res.status === 'deleted' || res.status === 'suspended',
                // deprecated
                isAccountPicked: true,
                isAccountActivated: true,
            };

            return queryResult;
        },
    },
};
