import { GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
import { IDs } from '../../openland-module-api/IDs';
import { geoIP } from '../../openland-utils/geoIP';
import { withActivatedUser } from '../../openland-module-api/Resolvers';
import { Modules } from '../../openland-modules/Modules';

export const Resolver: GQLResolver = {
    Session: {
        id: root => IDs.Session.serialize(root.token.uuid),
        lastIp: root => root.token.lastIp,
        lastLocation: root => geoIP(root.token.lastIp).location_name,
        lastSeen: root => root.presence?.lastSeen || null,
        online: root => root.presence ? Date.now() < root.presence.expires : false,
        platform: root => root.token.platform || null,
        current: (root, _, ctx) => root.token.uuid === ctx.auth.tid!,
    },
    Query: {
        activeSessions: withActivatedUser(async (ctx, args, uid) => {
            return await Modules.Auth.sessions.findActiveSessions(ctx, uid);
        })
    },
    Mutation: {
        terminateSession: withActivatedUser(async (ctx, args, uid) => {
            let tid = IDs.Session.parse(args.id);
            await Modules.Auth.sessions.terminateSession(ctx, uid, tid);
            return true;
        }),
        terminateAllSessionsExcept: withActivatedUser(async (ctx, args, uid) => {
            let tid = IDs.Session.parse(args.id);
            await Modules.Auth.sessions.terminateAllSessionsExcept(ctx, uid, tid);
            return true;
        }),
    },
};