import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { withPermission } from '../openland-module-api/Resolvers';
import { Modules } from '../openland-modules/Modules';
import { Store } from 'openland-module-db/FDB';

export const Resolver: GQLResolver = {
    EnvVar: {
       name: root => root.name,
       value: root => root.value,
    },

    Query: {
        envVars: withPermission('super-admin', async (ctx, args) => {
            return Store.EnvironmentVariable.findAll(ctx);
        }),
        envVar: withPermission('super-admin', async (ctx, args) => {
            return Store.EnvironmentVariable.findById(ctx, args.name);
        }),
    },

    Mutation: {
        setEnvVar: withPermission('super-admin', async (ctx, args) => {
            await Modules.Super.setEnvVar(ctx, args.name, args.value, true);
            return true;
        }),
        setEnvVarString: withPermission('super-admin', async (ctx, args) => {
            await Modules.Super.setEnvVar(ctx, args.name, `"${args.value}"`, true);
            return true;
        }),
        setEnvVarBoolean: withPermission('super-admin', async (ctx, args) => {
            await Modules.Super.setEnvVar(ctx, args.name, args.value.toString(), true);
            return true;
        }),
        setEnvVarNumber: withPermission('super-admin', async (ctx, args) => {
            await Modules.Super.setEnvVar(ctx, args.name, args.value.toString(), true);
            return true;
        }),
    },
};
