import { ApolloClient } from 'apollo-client';
import { InMemoryCache } from 'apollo-cache-inmemory';
import { SchemaLink } from 'apollo-link-schema';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { initApi } from './initApi';
import { initHealthcheck } from './initHealthcheck';
import { injectable } from 'inversify';
import { GQL_SPEC_VERSION } from './schema/SchemaSpec';
import { getSchemeVersion } from './schema/SchemaSpecGenerator';
import { buildSchema } from '../openland-graphql/buildSchema';
import { Schema } from './schema/Schema';
import { AuthContext } from 'openland-module-auth/AuthContext';
import { CacheContext } from './CacheContext';
import { FDB } from 'openland-module-db/FDB';
import { AppContext } from 'openland-modules/AppContext';
import { EmptyContext } from '@openland/context';

@injectable()
export class ApiModule {
    private schema = Schema(process.env.TESTING === 'true');

    start = async () => {
        console.log('start API Module');
        if (serverRoleEnabled('api')) {
            let currentSchemeSpecVersion = getSchemeVersion(buildSchema(__dirname + '/../'));

            if (GQL_SPEC_VERSION !== currentSchemeSpecVersion) {
                throw new Error(`Schema version mismatch expected ${GQL_SPEC_VERSION} got ${currentSchemeSpecVersion}, did you forgot to run yarn schema:gen ?`);
            }
            await initApi(false);
        } else {
            if (!serverRoleEnabled('admin')) {
                await initHealthcheck();
            }
        }
    }

    createClientForUser = async (email: string) => {
        let uid = (await FDB.User.findAll(EmptyContext)).find((v) => v.email === email)!.id;
        let tid = (await FDB.AuthToken.findAll(EmptyContext)).find((v) => v.uid === uid)!.uuid;
        return this.createClient({ uid, tid });
    }

    createClient = (args: { uid?: number, tid?: string }) => {
        let ctx = EmptyContext;
        if (args.uid && args.tid) {
            ctx = AuthContext.set(ctx, { uid: args.uid, tid: args.tid });
        }
        ctx = CacheContext.set(ctx, new Map());
        return new ApolloClient({
            cache: new InMemoryCache(),
            link: new SchemaLink({ schema: this.schema, context: new AppContext(ctx) })
        });
    }
}