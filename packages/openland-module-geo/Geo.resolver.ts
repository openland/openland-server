import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { withActivatedUser, withAny } from '../openland-module-api/Resolvers';
import { Modules } from 'openland-modules/Modules';
import { IDs } from '../openland-module-api/IDs';
import { geoIP } from '../openland-utils/geoIP';

export const Resolver: GQLResolver = {
    IpLocation: {
        ip: (root) => root.ip,
        location: (root, args, ctx) => root.coordinates || null,
        countryCode: (root, args, ctx) => root.location_code || null,
        locationName: (root, args, ctx) => root.location_name || null,
    },
    UserLocation: {
        id: root => IDs.User.serialize(root.uid),
        user: root => root.uid,
        isSharing: root => !!root.isSharing,
        lastLocations: root => root.lastLocations.map(a => a.location)
    },
    Query: {
        myLocation: withActivatedUser((ctx, args, uid) => Modules.Geo.getUserGeoUnsafe(ctx, uid)),
        ipLocation: withAny(async (ctx) => ctx.req.ip ? geoIP(ctx.req.ip) : null),
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
    //         subscribe: async function* (_: any, args: any, context: Context) {
    //
    //         }
    //     }
    // }
};
