import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { withAny } from '../openland-module-api/Resolvers';
import { geoIP } from '../openland-utils/geoIP';

export const Resolver: GQLResolver = {
    IpLocation: {
        ip: (root) => root.ip,
        location: (root, args, ctx) => root.coordinates || null,
        countryCode: (root, args, ctx) => root.location_code || null,
        locationName: (root, args, ctx) => root.location_name || null,
    },
    Query: {
        ipLocation: withAny(async (ctx) => ctx.req.ip ? geoIP(ctx.req.ip) : null)
    }
};
