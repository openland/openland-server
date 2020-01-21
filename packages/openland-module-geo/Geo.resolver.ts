import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { withActivatedUser } from '../openland-module-api/Resolvers';
import { Modules } from 'openland-modules/Modules';
import { IDs } from '../openland-module-api/IDs';
import { AppContext } from '../openland-modules/AppContext';

export default {
    UserLocation: {
        id: root => IDs.User.serialize(root.uid),
        user: root => root.uid,
        isSharing: root => !!root.isSharing,
        lastLocations: root => root.lastLocations.map(a => a.location)
    },
    Query: {
        myLocation: withActivatedUser((ctx, args, uid) => Modules.Geo.getUserGeoUnsafe(ctx, uid)),
        shouldShareLocation: withActivatedUser((ctx, args, uid) => Modules.Geo.shouldShareLocation(ctx, uid))
    },
    Mutation: {
        shareLocation: withActivatedUser( async (ctx, args, uid) => {
            await Modules.Geo.reportGeo(ctx, uid, args.location);
            return true;
        })
    },
    // Subscription: {
    //     shouldShareLocationUpdates: {
    //         subscribe: async function* (_: any, args: any, context: AppContext) {
    //
    //         }
    //     }
    // }
} as GQLResolver;