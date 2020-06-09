import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { withActivatedUser, withAny } from '../openland-module-api/Resolvers';
import { Modules } from 'openland-modules/Modules';
import { IDs } from '../openland-module-api/IDs';

export const Resolver: GQLResolver = {
    IpLocation: {
        ip: (root) => root,
        location: (root, args, ctx) => ctx.req.latLong || null,
        countryCode: (root, args, ctx) => ctx.req.location?.countryCode || null,
        locationName: (root, args, ctx) => ctx.req.location?.location || null,
    },
    UserLocation: {
        id: root => IDs.User.serialize(root.uid),
        user: root => root.uid,
        isSharing: root => !!root.isSharing,
        lastLocations: root => root.lastLocations.map(a => a.location)
    },
    Query: {
        myLocation: withActivatedUser((ctx, args, uid) => Modules.Geo.getUserGeoUnsafe(ctx, uid)),
        ipLocation: withAny(async (ctx) => ctx.req.ip || null),
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
};
