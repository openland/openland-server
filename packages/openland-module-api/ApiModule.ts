import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { initApi } from './initApi';
import { initHealthcheck } from './initHealthcheck';
import { injectable } from 'inversify';
import { GQL_SPEC_VERSION } from './schema/SchemaSpec';
import { getSchemeVersion } from './schema/SchemaSpecGenerator';
import { buildSchema } from '../openland-graphql/buildSchema';
import { Schema } from './schema/Schema';
import { createNamedContext } from '@openland/context';
import { createLogger } from '@openland/log';
import { Shutdown } from '../openland-utils/Shutdown';
import { GraphQLSchema } from 'graphql';
import { InMemoryQueryCache } from 'openland-mtproto3/queryCache';
import { SpaceXOperationResolver } from 'openland-spacex/SpaceXOperationResolver';
import { declareRemoteQueryExecutor } from '../openland-spacex/remoteExecutor';

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
        if (serverRoleEnabled('executor-calls')) {
            declareRemoteQueryExecutor('calls-resolver');
        }
        if (serverRoleEnabled('events-calls')) {
            declareRemoteQueryExecutor('calls-events');
        }
        if (serverRoleEnabled('events-chat')) {
            declareRemoteQueryExecutor('chat-events');
        }
    }
}
