import { Modules } from 'openland-modules/Modules';
import { FDB } from 'openland-module-db/FDB';
import { Context } from 'openland-utils/Context';
import { AuthContext } from 'openland-module-auth/AuthContext';

export default {
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
                    // depricated
                    isAccountPicked: false,
                    isAccountActivated: false,
                };
            }

            // User unknown?! Just softly ignore errors
            let res = await FDB.User.findById(ctx, auth.uid);
            if (res === null) {
                return {
                    isLoggedIn: false,
                    isProfileCreated: false,
                    isActivated: false,
                    isAccountExists: false,
                    isCompleted: false,
                    isBlocked: false,
                    // depricated
                    isAccountPicked: false,
                    isAccountActivated: false,
                };
            }

            // State 0: Is Logged In
            let isLoggedIn = true; // Checked in previous steps

            // Stage 1: Create Profile
            let profile = auth.uid ? (await Modules.Users.profileById(ctx, auth.uid)) : null;
            let isProfileCreated = !!profile;

            // Stage 2: Pick organization or create a new one (if there are no exists)
            let organization = !!auth.oid ? await FDB.Organization.findById(ctx, auth.oid) : null;
            let isOrganizationPicked = organization !== null;
            let orgsIDs = auth.uid ? await Modules.Orgs.findUserOrganizations(ctx, auth.uid) : [];
            let isOrganizationExists = orgsIDs.length > 0;

            // Stage 3: Activation Status
            let orgs = await Promise.all(orgsIDs.map((v) => FDB.Organization.findById(ctx, v)));
            let isAllOrganizationsSuspended = orgs.length > 0 && orgs.filter(o => o!.status === 'suspended').length === orgs.length;
            let isActivated = orgs.filter(o => o!.status === 'activated').length > 0;
            // depricated
            let isOrganizationActivated = isOrganizationPicked && organization!!.status !== 'pending';

            let queryResult = {
                isLoggedIn: isLoggedIn,
                isProfileCreated: isProfileCreated,
                isActivated: isActivated,
                isAccountExists: isOrganizationExists,
                isCompleted: isProfileCreated && isOrganizationExists && isOrganizationPicked && isActivated,
                isBlocked: isAllOrganizationsSuspended,
                // depricated
                isAccountPicked: isOrganizationPicked,
                isAccountActivated: isOrganizationActivated,
            };

            return queryResult;
        },
    },
};