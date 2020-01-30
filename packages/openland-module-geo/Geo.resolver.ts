import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { withActivatedUser } from '../openland-module-api/Resolvers';
import { Modules } from 'openland-modules/Modules';
import { IDs } from '../openland-module-api/IDs';
import { AppContext } from 'openland-modules/AppContext';
import { Store } from 'openland-module-db/FDB';
import { AuthContext } from '../openland-module-auth/AuthContext';
import { AccessDeniedError } from '../openland-errors/AccessDeniedError';

export default {
    UserLocation: {
        id: root => IDs.User.serialize(root.uid),
        user: root => root.uid,
        isSharing: root => root.lastLocations.length > 0,
        lastLocations: root => root.lastLocations.filter(a => a.tid === root.lastLocations[0].tid).map(a => a.location)
    },
    Query: {
        myLocation: withActivatedUser((ctx, args, uid) => Modules.Geo.getUserGeoUnsafe(ctx, uid)),
        shouldShareLocation: withActivatedUser((ctx, args, uid) => Modules.Geo.shouldShareLocation(ctx, uid)),
        serverDate: () => Date.now(),
    },
    Mutation: {
        shareLocation: withActivatedUser( async (ctx, args, uid) => {
            await Modules.Geo.reportGeo(ctx, uid, ctx.auth.tid!, args.date ? args.date.getTime() : Date.now(), args.location);
            return true;
        })
    },
    Subscription: {
        shouldShareLocationUpdates: {
            subscribe: async function * (_: any, args: any, context: AppContext) {
                let auth = AuthContext.get(context);
                if (!auth.uid) {
                    throw new AccessDeniedError();
                }

                let res = yield await Modules.Geo.shouldShareLocation(context, auth.uid);

                // @ts-ignore
                for await (let event of Store.PermissionEventStore.createLiveStream(context, auth.uid, { batchSize: 1 })) {
                    let shouldShareLocation = await Modules.Geo.shouldShareLocation(context, auth.uid);
                    if (res !== shouldShareLocation) {
                        res = yield shouldShareLocation;
                    }
                }
            }
        }
    }
} as GQLResolver;