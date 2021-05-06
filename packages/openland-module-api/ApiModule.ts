import { Config } from 'openland-config/Config';
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
import { Store } from 'openland-module-db/FDB';
import { createNamedContext } from '@openland/context';
import { withLogMeta, createLogger } from '@openland/log';
import { Shutdown } from '../openland-utils/Shutdown';
import { GraphQLSchema } from 'graphql';
import { InMemoryQueryCache } from 'openland-mtproto3/queryCache';
import { SpaceXOperationResolver } from 'openland-spacex/SpaceXOperationResolver';
import { declareRemoteQueryExecutor } from './remoteExecutor';

const defaultCtx = createNamedContext('ctx');
const logger = createLogger('api-module');

@injectable()
export class ApiModule {

    private _queryResolver: SpaceXOperationResolver | null = null;
    get queryResolver(): SpaceXOperationResolver {
        if (!this._queryResolver) {
            this._queryResolver = new SpaceXOperationResolver(this.schema);
        }
        return this._queryResolver;
    }

    readonly queryCache: InMemoryQueryCache = new InMemoryQueryCache();

    private _schema: GraphQLSchema | null = null;
    get schema(): GraphQLSchema {
        if (!this._schema) {
            this._schema = Schema();
        }
        return this._schema;
    }

    start = async () => {
        logger.log(defaultCtx, 'Start API Module');
        if (serverRoleEnabled('api')) {
            let currentSchemeSpecVersion = getSchemeVersion(buildSchema(__dirname + '/../'));

            if (GQL_SPEC_VERSION !== currentSchemeSpecVersion) {
                throw new Error(`Schema version mismatch expected ${GQL_SPEC_VERSION} got ${currentSchemeSpecVersion}, did you forgot to run yarn schema:gen ?`);
            }
            let server = await initApi(false);
            Shutdown.registerWork({
                name: 'api-server',
                shutdown: () => new Promise(resolve => {
                    server.close(() => resolve());
                })
            });
        } else {
            if (!serverRoleEnabled('admin')) {
                let server = await initHealthcheck();
                if (server) {
                    Shutdown.registerWork({
                        name: 'healthcheck-server',
                        shutdown: () => new Promise(resolve => {
                            server!.close(() => resolve());
                        })
                    });
                }
            }
        }

        if (serverRoleEnabled('executor')) {
            declareRemoteQueryExecutor('default');
        }
    }

    createClientForUser = async (email: string) => {
        let uid = (await Store.User.findAll(defaultCtx)).find((v) => v.email === email)!.id;
        let tid = (await Store.AuthToken.findAll(defaultCtx)).find((v) => v.uid === uid)!.uuid;
        return this.createClient({ uid, tid });
    }

    createClient = (args: { uid?: number, tid?: string }) => {
        let ctx = defaultCtx;
        if (args.uid && args.tid) {
            ctx = AuthContext.set(ctx, { uid: args.uid, tid: args.tid });
            ctx = withLogMeta(ctx, { uid: args.uid, tid: args.tid });
        }
        ctx = CacheContext.set(ctx, new Map());
        return new ApolloClient({
            cache: new InMemoryCache(),
            link: new SchemaLink({ schema: Schema(Config.environment === 'test'), context: ctx })
        });
    }
}
