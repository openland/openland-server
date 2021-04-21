import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { GQLRoots } from '../openland-module-api/schema/SchemaRoots';
import ReleasePlatformRoot = GQLRoots.ReleasePlatformRoot;
import { withPermission, withUser } from '../openland-module-api/Resolvers';
import { Store } from '../openland-module-db/FDB';
import { UserError } from '../openland-errors/UserError';
import { fetchNextDBSeq } from '../openland-utils/dbSeq';

const versionToInt = (v: string) => parseInt(v.replace(/\./g, ''), 10);

export const Resolver: GQLResolver = {
    AppRelease: {
        platform: src => src.platform.toUpperCase() as ReleasePlatformRoot,
        version: src => src.version,
        notes: src => src.releaseNotes,
        date: src => new Date(src.releaseDate)
    },

    Query: {
        latestAppRelease: withUser(async (ctx, args, uid) => {
            let res = await Store.AppRelease.platform.query(ctx, args.platform.toLowerCase(), { limit: 1, reverse: true });
            if (res.items.length === 0) {
                return null;
            }

            return res.items[0];
        }),
        appReleases: withUser(async (ctx, args, uid) => {
            return await Store.AppRelease.platform.findAll(ctx, args.platform.toLowerCase());
        })
    },

    Mutation: {
        superAddAppRelease: withPermission('super-admin', async (ctx, args) => {
            let res = await Store.AppRelease.platform.query(ctx, args.platform.toLowerCase(), { limit: 1, reverse: true });
            let latest = res.items.length > 0 ? res.items[0] : null;

            if (latest && versionToInt(latest.version) > versionToInt(args.version)) {
                throw new UserError(`Version provided (${args.version}) is lower than last release version (${latest.version})`);
            }

            let id = await fetchNextDBSeq(ctx, 'app-release');
            return await Store.AppRelease.create(ctx, args.platform.toLowerCase(), id, {
                version: args.version,
                releaseNotes: args.notes,
                releaseDate: Date.now()
            });
        })
    }
};